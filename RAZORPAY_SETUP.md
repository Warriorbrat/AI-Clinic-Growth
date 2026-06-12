## Razorpay Complete Setup Guide

### 1. Create Your Razorpay Account
Go to https://razorpay.com → Sign Up → Complete KYC with:
- PAN card
- Bank account details
- Business registration (or GST number)
KYC approval takes 1-2 business days.

---

### 2. Get API Keys
Dashboard → Settings → API Keys → Generate Live Keys
```
RAZORPAY_KEY_ID     = rzp_live_xxxxxxxxxx
RAZORPAY_KEY_SECRET = xxxxxxxxxxxxxxxxxxxxxxxx
```
For testing first, use Test Keys (rzp_test_...) — no real money moves.

---

### 3. Create Subscription Plans (for recurring billing)
Dashboard → Products → Subscriptions → Plans → + Create Plan

**Plan 1: Starter Monthly**
- Plan Name: Starter Monthly
- Billing Cycle: monthly
- Billing Interval: 1
- Amount: 199900  (₹1,999 in paise)
- Currency: INR
- Copy the plan_id → RZP_PLAN_STARTER_MONTHLY

**Plan 2: Starter Yearly**
- Plan Name: Starter Yearly
- Billing Cycle: yearly
- Amount: 1999900  (₹19,999)
- Copy → RZP_PLAN_STARTER_YEARLY

**Plan 3: Growth Monthly** → Amount: 299900 → RZP_PLAN_GROWTH_MONTHLY
**Plan 4: Growth Yearly**  → Amount: 2999900 → RZP_PLAN_GROWTH_YEARLY
**Plan 5: Enterprise Monthly** → Amount: 499900 → RZP_PLAN_ENTERPRISE_MONTHLY
**Plan 6: Enterprise Yearly**  → Amount: 4999900 → RZP_PLAN_ENTERPRISE_YEARLY

---

### 4. Configure Webhook
Dashboard → Settings → Webhooks → + Add New Webhook

URL: `https://api.yourclinic.com/api/v1/billing/webhook`

Select events:
✓ payment.captured
✓ payment.failed
✓ subscription.charged
✓ subscription.halted
✓ subscription.cancelled
✓ refund.created

Secret: generate a strong random string → RAZORPAY_WEBHOOK_SECRET

---

### 5. Enable Auto-Capture
Dashboard → Settings → Account Settings → Payment Capture
→ Set to "Automatic" with 0 seconds delay

---

### 6. Add GST Details
Dashboard → Settings → Tax Settings
→ Enter your GST number
→ Razorpay will auto-add 18% GST to invoices

---

### 7. Payout Account
Dashboard → Settings → Bank Account
→ Add your business bank account
→ Enable auto settlement (T+2 days)

---

### 8. Test the Complete Flow Locally

```bash
# Start backend
cd backend && npm run dev

# Test order creation (replace TOKEN with your clinic JWT)
curl -X POST http://localhost:5000/api/v1/billing/order \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id":"growth","billing_cycle":"monthly"}'

# Use Razorpay test card: 4111 1111 1111 1111
# Expiry: any future date, CVV: any 3 digits
# UPI: success@razorpay
```

---

### 9. Going Live Checklist
- [ ] KYC approved ✓
- [ ] Test mode payments working ✓
- [ ] Switch to live keys in .env ✓
- [ ] Webhook URL pointing to production backend ✓
- [ ] GST number added ✓
- [ ] Bank account verified ✓
- [ ] Auto-capture enabled ✓
