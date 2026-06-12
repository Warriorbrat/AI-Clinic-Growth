const Razorpay = require('razorpay');
const crypto   = require('crypto');
const { Clinics, Payments } = require('../config/db');
const logger = require('../utils/logger');

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── Pricing (in INR paise: 1 INR = 100 paise) ──────────────────────────────
const PLANS = {
  starter: {
    name:          'Starter',
    monthly_paise: 199900,   // ₹1,999/month
    yearly_paise:  1999900,  // ₹19,999/year (₹1,666/mo)
    features: [
      'Up to 200 leads/month',
      'WhatsApp + Web Chat',
      'AI conversations',
      'Basic CRM',
      'Email support',
    ],
    razorpay_plan_id_monthly: process.env.RZP_PLAN_STARTER_MONTHLY,
    razorpay_plan_id_yearly:  process.env.RZP_PLAN_STARTER_YEARLY,
  },
  growth: {
    name:          'Growth',
    monthly_paise: 299900,   // ₹2,999/month
    yearly_paise:  2999900,  // ₹29,999/year (₹2,499/mo)
    features: [
      'Up to 1,000 leads/month',
      'All 5 channels',
      'AI conversations',
      'Full CRM + Analytics',
      'Reminders & follow-ups',
      'Priority support',
    ],
    razorpay_plan_id_monthly: process.env.RZP_PLAN_GROWTH_MONTHLY,
    razorpay_plan_id_yearly:  process.env.RZP_PLAN_GROWTH_YEARLY,
    badge: 'Most Popular',
  },
  enterprise: {
    name:          'Enterprise',
    monthly_paise: 499900,   // ₹4,999/month
    yearly_paise:  4999900,  // ₹49,999/year (₹4,166/mo)
    features: [
      'Unlimited leads',
      'All channels + Instagram',
      'Custom AI training',
      'White-label option',
      'API access',
      'Dedicated account manager',
    ],
    razorpay_plan_id_monthly: process.env.RZP_PLAN_ENTERPRISE_MONTHLY,
    razorpay_plan_id_yearly:  process.env.RZP_PLAN_ENTERPRISE_YEARLY,
  },
};

// ─── Get all plans (for pricing page) ───────────────────────────────────────
const getPlans = () => {
  return Object.entries(PLANS).map(([key, plan]) => ({
    id:            key,
    name:          plan.name,
    badge:         plan.badge,
    monthly_price: plan.monthly_paise / 100,
    yearly_price:  plan.yearly_paise  / 100,
    monthly_per_year: Math.round(plan.yearly_paise / 12) / 100,
    features:      plan.features,
  }));
};

// ─── Create a one-time Razorpay order (for first payment) ───────────────────
const createOrder = async (clinic_id, plan_id, billing_cycle = 'monthly') => {
  const plan = PLANS[plan_id];
  if (!plan) throw new Error(`Invalid plan: ${plan_id}`);

  const amount = billing_cycle === 'yearly' ? plan.yearly_paise : plan.monthly_paise;

  const order = await rzp.orders.create({
    amount,
    currency:  'INR',
    receipt:   `clinic_${clinic_id}_${Date.now()}`,
    notes: { clinic_id, plan: plan_id, billing_cycle },
  });

  // Log pending payment
  await Payments.create({
    clinic_id,
    razorpay_order_id: order.id,
    amount:            amount / 100,
    plan:              plan_id,
    billing_cycle,
    status:            'pending',
    metadata:          { order },
  });

  return {
    order_id:  order.id,
    amount:    order.amount,
    currency:  order.currency,
    key_id:    process.env.RAZORPAY_KEY_ID,
    plan_name: plan.name,
  };
};

// ─── Verify payment signature after frontend confirms ───────────────────────
const verifyAndActivate = async (clinic_id, { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, billing_cycle }) => {
  // 1. Verify signature (HMAC-SHA256)
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    logger.warn('Payment signature mismatch', { clinic_id, razorpay_order_id });
    throw Object.assign(new Error('Payment verification failed'), { statusCode: 400 });
  }

  // 2. Capture the payment (auto-capture should be on in Razorpay dashboard, but belt+suspenders)
  try {
    const plan    = PLANS[plan_id];
    const amount  = billing_cycle === 'yearly' ? plan.yearly_paise : plan.monthly_paise;
    await rzp.payments.capture(razorpay_payment_id, amount, 'INR');
  } catch (err) {
    // Already captured — that's fine
    if (!err.error?.description?.includes('already')) throw err;
  }

  // 3. Calculate subscription period
  const now      = new Date();
  const periodEnd = billing_cycle === 'yearly'
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // 4. Update payment record
  await Payments.updateByOrderId(razorpay_order_id, {
    razorpay_payment_id,
    razorpay_signature,
    status:       'captured',
    paid_at:      now.toISOString(),
    period_start: now.toISOString(),
    period_end:   periodEnd.toISOString(),
  });

  // 5. Activate clinic subscription
  await Clinics.update(clinic_id, {
    subscription_plan:        plan_id,
    subscription_expires_at:  periodEnd.toISOString(),
    subscription_active:      true,
  });

  logger.info('Subscription activated', { clinic_id, plan: plan_id, billing_cycle, expires: periodEnd });

  return {
    success:     true,
    plan:        plan_id,
    expires_at:  periodEnd.toISOString(),
    billing_cycle,
  };
};

// ─── Razorpay Webhook handler ────────────────────────────────────────────────
const handleWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  // req.body is a Buffer when express.raw() is used — convert to string for HMAC
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody).digest('hex');

  if (expected !== signature) {
    logger.warn('Razorpay webhook signature invalid');
    return res.status(400).send('Invalid signature');
  }

  // Parse body — it's either already an object (JSON middleware) or a raw string
  let event;
  try {
    event = typeof req.body === 'object' && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse(rawBody);
  } catch {
    return res.status(400).send('Invalid JSON body');
  }

  const payload = event.payload?.payment?.entity || event.payload?.subscription?.entity;

  logger.info('Razorpay webhook', { event: event.event });

  try {
    switch (event.event) {
      case 'payment.captured': {
        const notes = payload.notes || {};
        if (notes.clinic_id) {
          await Payments.updateByOrderId(payload.order_id, {
            razorpay_payment_id: payload.id,
            status:  'captured',
            paid_at: new Date().toISOString(),
          });
        }
        break;
      }
      case 'payment.failed': {
        const notes = payload.notes || {};
        await Payments.updateByOrderId(payload.order_id, {
          status:         'failed',
          failure_reason: payload.error_description || 'Payment failed',
        });
        break;
      }
      case 'subscription.charged': {
        // Recurring subscription payment — extend clinic subscription
        const sub = payload;
        if (sub.notes?.clinic_id) {
          const periodEnd = new Date(sub.current_end * 1000);
          await Clinics.update(sub.notes.clinic_id, {
            subscription_expires_at: periodEnd.toISOString(),
            subscription_active:     true,
          });
          logger.info('Subscription renewed', { clinic_id: sub.notes.clinic_id, until: periodEnd });
        }
        break;
      }
      case 'subscription.cancelled': {
        if (payload.notes?.clinic_id) {
          await Clinics.update(payload.notes.clinic_id, {
            subscription_active: false,
          });
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Razorpay webhook processing error', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Check if clinic subscription is still active ───────────────────────────
const checkSubscription = (clinic) => {
  if (!clinic.subscription_active) return { active: false, reason: 'cancelled' };
  if (!clinic.subscription_expires_at) return { active: true, plan: clinic.subscription_plan };
  const expired = new Date(clinic.subscription_expires_at) < new Date();
  return {
    active:     !expired,
    plan:        clinic.subscription_plan,
    expires_at:  clinic.subscription_expires_at,
    reason:      expired ? 'expired' : null,
  };
};

module.exports = { getPlans, createOrder, verifyAndActivate, handleWebhook, checkSubscription, PLANS };
