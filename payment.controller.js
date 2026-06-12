const { getPlans, createOrder, verifyAndActivate, checkSubscription } = require('../services/payments/razorpay.service');
const { Payments } = require('../config/db');
const { success, created, badRequest, forbidden } = require('../utils/response');

const PaymentController = {
  // GET /api/v1/billing/plans
  async plans(req, res, next) {
    try {
      const plans = getPlans();
      return success(res, plans);
    } catch (err) { next(err); }
  },

  // POST /api/v1/billing/order  { plan_id, billing_cycle }
  async createOrder(req, res, next) {
    try {
      const { plan_id, billing_cycle = 'monthly' } = req.body;
      if (!plan_id) return badRequest(res, 'plan_id is required');
      const order = await createOrder(req.clinicId, plan_id, billing_cycle);
      return created(res, order, 'Order created');
    } catch (err) { next(err); }
  },

  // POST /api/v1/billing/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, billing_cycle }
  async verifyPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, billing_cycle } = req.body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_id) {
        return badRequest(res, 'razorpay_order_id, razorpay_payment_id, razorpay_signature and plan_id are required');
      }
      const result = await verifyAndActivate(req.clinicId, { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, billing_cycle });
      return success(res, result, 'Subscription activated');
    } catch (err) { next(err); }
  },

  // GET /api/v1/billing/status
  async status(req, res, next) {
    try {
      const sub = checkSubscription(req.clinic);
      return success(res, sub);
    } catch (err) { next(err); }
  },

  // GET /api/v1/billing/history
  async history(req, res, next) {
    try {
      const payments = await Payments.listByClinic(req.clinicId);
      return success(res, payments);
    } catch (err) { next(err); }
  },
};

module.exports = PaymentController;
