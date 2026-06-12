import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../services/api';
import api from '../services/api';

// Load Razorpay SDK dynamically
const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload  = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const PLAN_COLORS = {
  starter:    { border: '#3b82f6', badge: 'rgba(59,130,246,0.1)', text: '#3b82f6' },
  growth:     { border: '#00d4aa', badge: 'rgba(0,212,170,0.12)', text: '#00d4aa' },
  enterprise: { border: '#f59e0b', badge: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
};

export default function Billing({ clinic }) {
  const [plans, setPlans]         = useState([]);
  const [billing, setBilling]     = useState('monthly');
  const [subStatus, setSubStatus] = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState('');
  const [tab, setTab]             = useState('plans');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    api.get('/billing/plans').then(r => setPlans(r.data.data || []));
    api.get('/billing/status').then(r => setSubStatus(r.data.data));
    api.get('/billing/history').then(r => setHistory(r.data.data || []));
  }, []);

  const handleSubscribe = async (plan_id) => {
    const sdkLoaded = await loadRazorpay();
    if (!sdkLoaded) { alert('Razorpay SDK failed to load. Check your internet connection.'); return; }

    setLoading(plan_id);
    try {
      const res = await api.post('/billing/order', { plan_id, billing_cycle: billing });
      const order = res.data.data;

      const options = {
        key:         order.key_id,
        amount:      order.amount,
        currency:    order.currency,
        name:        'AI Clinic Growth System',
        description: `${order.plan_name} Plan — ${billing === 'yearly' ? 'Annual' : 'Monthly'}`,
        image:       'https://your-cdn.com/logo.png',
        order_id:    order.order_id,
        prefill: {
          name:    clinic?.name,
          email:   clinic?.email,
          contact: clinic?.phone,
        },
        theme: { color: '#00d4aa' },
        handler: async (response) => {
          try {
            const verify = await api.post('/billing/verify', {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan_id,
              billing_cycle: billing,
            });
            setSubStatus(verify.data.data);
            setSuccessMsg(`🎉 ${order.plan_name} activated! Your clinic is now on the ${plan_id} plan.`);
            setTab('status');
            // Refresh payment history
            api.get('/billing/history').then(r => setHistory(r.data.data || []));
          } catch (err) {
            alert('Payment verification failed. Contact support with your payment ID: ' + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: () => setLoading(''),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        alert(`Payment failed: ${resp.error.description}`);
        setLoading('');
      });
      rzp.open();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create order. Try again.');
    }
    setLoading('');
  };

  const currentPlan = subStatus?.plan || clinic?.subscription_plan || 'starter';
  const isActive    = subStatus?.active !== false;

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      {/* Tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--surface2)', padding:4, borderRadius:10, width:'fit-content', marginBottom:24 }}>
        {[['plans','💳 Plans'],['status','📊 Status'],['history','🧾 History']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:'7px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13,
            fontFamily:'DM Sans, sans-serif', transition:'all 0.15s',
            background: tab===id ? 'var(--surface)' : 'transparent',
            color:      tab===id ? 'var(--text)' : 'var(--muted)',
            fontWeight: tab===id ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {successMsg && (
        <div style={{ background:'rgba(0,212,170,0.12)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:10, padding:'14px 18px', marginBottom:20, color:'var(--accent)', fontSize:14 }}>
          {successMsg}
        </div>
      )}

      {/* ── Plans Tab ──────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <>
          {/* Billing toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
            <span style={{ fontSize:14, color: billing==='monthly' ? 'var(--text)' : 'var(--muted)' }}>Monthly</span>
            <div onClick={() => setBilling(b => b==='monthly'?'yearly':'monthly')}
              style={{ width:44, height:24, borderRadius:12, background: billing==='yearly' ? 'var(--accent)' : 'var(--surface2)',
                cursor:'pointer', position:'relative', transition:'background 0.2s', border:'1px solid var(--border)' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff',
                position:'absolute', top:2, transition:'left 0.2s',
                left: billing==='yearly' ? 22 : 4 }}/>
            </div>
            <span style={{ fontSize:14, color: billing==='yearly' ? 'var(--text)' : 'var(--muted)' }}>
              Yearly <span style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>Save ~17%</span>
            </span>
          </div>

          {/* Plan cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {plans.map(plan => {
              const colors  = PLAN_COLORS[plan.id] || PLAN_COLORS.starter;
              const isCurrent = plan.id === currentPlan;
              const price  = billing === 'yearly' ? plan.monthly_per_year : plan.monthly_price;
              const total  = billing === 'yearly' ? plan.yearly_price : plan.monthly_price;

              return (
                <div key={plan.id} style={{
                  background:'var(--surface)', border:`1.5px solid ${isCurrent ? colors.border : 'var(--border)'}`,
                  borderRadius:14, padding:24, display:'flex', flexDirection:'column', gap:16,
                  position:'relative', transition:'border-color 0.2s',
                }}>
                  {plan.badge && (
                    <div style={{ position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)',
                      background:colors.border, color:'#0a0e1a', fontSize:11, fontWeight:700,
                      padding:'3px 12px', borderRadius:20 }}>{plan.badge}</div>
                  )}

                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:18, color:colors.text }}>{plan.name}</div>
                    <div style={{ marginTop:10 }}>
                      <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:32, color:'var(--text)' }}>
                        ₹{price?.toLocaleString('en-IN')}
                      </span>
                      <span style={{ color:'var(--muted)', fontSize:13 }}>/mo</span>
                    </div>
                    {billing === 'yearly' && (
                      <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                        Billed ₹{total?.toLocaleString('en-IN')}/year
                      </div>
                    )}
                  </div>

                  <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:8 }}>
                    {(plan.features || []).map((f, i) => (
                      <li key={i} style={{ fontSize:13, color:'var(--muted)', display:'flex', gap:8, alignItems:'flex-start' }}>
                        <span style={{ color:colors.text, flexShrink:0, marginTop:1 }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading === plan.id || (isCurrent && isActive)}
                    style={{
                      marginTop:'auto', padding:'11px', borderRadius:9, border:'none', cursor:'pointer',
                      fontSize:14, fontWeight:600, fontFamily:'DM Sans,sans-serif', transition:'all 0.15s',
                      background: isCurrent && isActive ? 'var(--surface2)' : colors.border,
                      color:      isCurrent && isActive ? 'var(--muted)'    : '#0a0e1a',
                      opacity:    loading === plan.id ? 0.7 : 1,
                    }}>
                    {loading === plan.id ? 'Processing…'
                      : isCurrent && isActive ? '✓ Current Plan'
                      : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:20, padding:16, background:'var(--surface2)', borderRadius:10, fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>
            <strong style={{ color:'var(--text)' }}>Secure payments via Razorpay</strong> — All major cards, UPI, Net Banking, and wallets accepted.
            Subscriptions auto-renew. Cancel anytime from the Settings page. GST applicable as per government norms.
          </div>
        </>
      )}

      {/* ── Status Tab ─────────────────────────────────────────────────── */}
      {tab === 'status' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16, marginBottom:16 }}>Current Subscription</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {[
                { label:'Plan',     value: (currentPlan || 'Starter').charAt(0).toUpperCase() + (currentPlan||'starter').slice(1) },
                { label:'Status',   value: isActive ? '✅ Active' : '❌ Expired' },
                { label:'Renews',   value: subStatus?.expires_at ? new Date(subStatus.expires_at).toLocaleDateString('en-IN') : '—' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{s.label}</div>
                  <div style={{ fontSize:18, fontFamily:'Syne,sans-serif', fontWeight:700, marginTop:4 }}>{s.value}</div>
                </div>
              ))}
            </div>
            {!isActive && (
              <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setTab('plans')}>
                Renew Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── History Tab ────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Plan</th><th>Amount</th><th>Billing</th><th>Status</th><th>Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:40 }}>No payment history yet</td></tr>
              ) : history.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize:13 }}>{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={{ textTransform:'capitalize', fontSize:13 }}>{p.plan}</td>
                  <td style={{ fontWeight:600 }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td style={{ fontSize:12, color:'var(--muted)', textTransform:'capitalize' }}>{p.billing_cycle}</td>
                  <td>
                    <span style={{
                      fontSize:12, padding:'3px 10px', borderRadius:20, fontWeight:600,
                      background: p.status==='captured' ? 'rgba(0,212,170,0.12)' : 'rgba(239,68,68,0.12)',
                      color:      p.status==='captured' ? 'var(--accent)' : '#ef4444',
                    }}>{p.status}</span>
                  </td>
                  <td style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>
                    {p.razorpay_payment_id || p.razorpay_order_id || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
