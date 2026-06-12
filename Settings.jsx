import React, { useState } from 'react';
import { useClinicProfile, useUpdateClinic } from '../hooks/useApi';
import { clinicApi } from '../services/api';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const defaultHour = { open: '09:00', close: '18:00', enabled: true };

export default function Settings() {
  const { data: clinic, isLoading } = useClinicProfile();
  const updateClinic = useUpdateClinic();
  const [tab, setTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(null);

  React.useEffect(() => {
    if (clinic && !form) {
      setForm({
        name:     clinic.name     || '',
        phone:    clinic.phone    || '',
        address:  clinic.address  || '',
        timezone: clinic.timezone || 'Asia/Kolkata',
        aiConfig: {
          personality:   clinic.aiConfig?.personality   || 'professional and warm',
          clinicContext: clinic.aiConfig?.clinicContext  || '',
          language:      clinic.aiConfig?.language       || 'English',
        },
        workingHours: clinic.workingHours || Object.fromEntries(DAYS.map(d => [d, { ...defaultHour }])),
        services: clinic.services || [],
      });
    }
  }, [clinic]);

  const save = async () => {
    await updateClinic.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const connectCalendar = async () => {
    const res = await clinicApi.getCalendarUrl();
    window.location.href = res.data.data.url;
  };

  if (isLoading || !form) return (
    <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading settings…</div>
  );

  const tabs = [
    { id: 'general',   label: '🏥 General' },
    { id: 'hours',     label: '🕐 Working Hours' },
    { id: 'services',  label: '💉 Services' },
    { id: 'ai',        label: '🤖 AI Config' },
    { id: 'integrations', label: '🔗 Integrations' },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 760 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface2)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
              background: tab === t.id ? 'var(--surface)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--muted)',
              fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── General ──────────────────────────────────────────────────── */}
      {tab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Clinic Name', key: 'name', type: 'text' },
            { label: 'Phone Number', key: 'phone', type: 'text' },
            { label: 'Address', key: 'address', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input className="input" type={f.type} value={form[f.key] || ''}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}/>
            </div>
          ))}
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Timezone</label>
            <select className="select-filter" style={{ width: '100%', padding: '10px 14px' }}
              value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
              {['Asia/Kolkata','Asia/Dubai','Asia/Singapore','America/New_York','Europe/London'].map(tz =>
                <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── Working Hours ─────────────────────────────────────────────── */}
      {tab === 'hours' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DAYS.map(day => {
            const h = form.workingHours[day] || defaultHour;
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={h.enabled}
                    onChange={e => setForm(p => ({ ...p, workingHours: { ...p.workingHours, [day]: { ...h, enabled: e.target.checked } } }))}
                    style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}/>
                  <span style={{ fontSize: 14, width: 90, textTransform: 'capitalize', color: h.enabled ? 'var(--text)' : 'var(--muted)' }}>{day}</span>
                </label>
                {h.enabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={h.open}  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13 }}
                      onChange={e => setForm(p => ({ ...p, workingHours: { ...p.workingHours, [day]: { ...h, open: e.target.value } } }))}/>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>to</span>
                    <input type="time" value={h.close} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13 }}
                      onChange={e => setForm(p => ({ ...p, workingHours: { ...p.workingHours, [day]: { ...h, close: e.target.value } } }))}/>
                  </div>
                ) : <span style={{ fontSize: 13, color: 'var(--muted)' }}>Closed</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Services ─────────────────────────────────────────────────── */}
      {tab === 'services' && (
        <div>
          {form.services.map((svc, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <input className="input" placeholder="Service name" value={svc.name} style={{ flex: 2 }}
                onChange={e => { const s = [...form.services]; s[i].name = e.target.value; setForm(p => ({ ...p, services: s })); }}/>
              <input className="input" placeholder="Duration (min)" type="number" value={svc.durationMin || 30} style={{ flex: 1 }}
                onChange={e => { const s = [...form.services]; s[i].durationMin = Number(e.target.value); setForm(p => ({ ...p, services: s })); }}/>
              <input className="input" placeholder="Min price ₹" type="number" value={svc.priceMin || ''} style={{ flex: 1 }}
                onChange={e => { const s = [...form.services]; s[i].priceMin = Number(e.target.value); setForm(p => ({ ...p, services: s })); }}/>
              <input className="input" placeholder="Max price ₹" type="number" value={svc.priceMax || ''} style={{ flex: 1 }}
                onChange={e => { const s = [...form.services]; s[i].priceMax = Number(e.target.value); setForm(p => ({ ...p, services: s })); }}/>
              <button onClick={() => { const s = form.services.filter((_,j) => j !== i); setForm(p => ({ ...p, services: s })); }}
                style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 4 }}
            onClick={() => setForm(p => ({ ...p, services: [...p.services, { name: '', durationMin: 30, priceMin: 0, priceMax: 0 }] }))}>
            + Add Service
          </button>
        </div>
      )}

      {/* ── AI Config ────────────────────────────────────────────────── */}
      {tab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>AI Personality</label>
            <input className="input" value={form.aiConfig.personality}
              onChange={e => setForm(p => ({ ...p, aiConfig: { ...p.aiConfig, personality: e.target.value } }))}
              placeholder="e.g. Professional, warm, and concise. Like a trusted medical friend."/>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Language</label>
            <select className="select-filter" style={{ width: '100%', padding: '10px 14px' }}
              value={form.aiConfig.language} onChange={e => setForm(p => ({ ...p, aiConfig: { ...p.aiConfig, language: e.target.value } }))}>
              {['English','Hindi','Hinglish','Tamil','Telugu','Kannada','Malayalam','Marathi','Gujarati','Bengali'].map(l =>
                <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
              Clinic Context <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(injected into every AI conversation)</span>
            </label>
            <textarea className="input" rows={5} value={form.aiConfig.clinicContext}
              onChange={e => setForm(p => ({ ...p, aiConfig: { ...p.aiConfig, clinicContext: e.target.value } }))}
              placeholder="Tell the AI about your clinic: specialisations, doctors, unique selling points, what makes you different..."
              style={{ resize: 'vertical', lineHeight: 1.6 }}/>
          </div>
        </div>
      )}

      {/* ── Integrations ─────────────────────────────────────────────── */}
      {tab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { name: 'Google Calendar', desc: 'Auto-detect free slots and create appointment events', connected: !!clinic?.googleCalendarId, action: connectCalendar, actionLabel: 'Connect Google Calendar', icon: '📅' },
            { name: 'Twilio WhatsApp', desc: `WhatsApp number: ${clinic?.whatsappNumber || 'Not configured'}`, connected: !!clinic?.whatsappNumber, icon: '💬' },
            { name: 'Twilio Voice',    desc: `Phone number: ${clinic?.twilioPhoneNumber || 'Not configured'}`, connected: !!clinic?.twilioPhoneNumber, icon: '📞' },
          ].map(int => (
            <div key={int.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 28 }}>{int.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>{int.name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{int.desc}</div>
              </div>
              {int.connected
                ? <span style={{ fontSize: 12, color: 'var(--accent)', background: 'rgba(0,212,170,0.12)', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>✓ Connected</span>
                : int.action
                  ? <button className="btn btn-primary btn-sm" onClick={int.action}>{int.actionLabel}</button>
                  : <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface2)', padding: '4px 10px', borderRadius: 20 }}>Configure in .env</span>
              }
            </div>
          ))}

          <div style={{ padding: 16, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 8 }}>🌐 Web Chat Widget</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Embed on your clinic website:</div>
            <pre style={{ background: '#0a0e1a', padding: 12, borderRadius: 8, fontSize: 12, color: '#4ade80', overflow: 'auto', lineHeight: 1.6 }}>{`<script>
  window.ACGS_CONFIG = {
    clinicId:  '${clinic?._id || 'YOUR_CLINIC_ID'}',
    apiUrl:    'https://api.yourclinic.com',
    clinicName: '${clinic?.name || 'Your Clinic'}',
    themeColor: '#00d4aa',
  };
</script>
<script src="https://cdn.yourclinic.com/widget.js" async></script>`}</pre>
          </div>
        </div>
      )}

      {/* ── Save button ───────────────────────────────────────────────── */}
      {tab !== 'integrations' && (
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={updateClinic.isPending}>
            {updateClinic.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span style={{ color: 'var(--accent)', fontSize: 13 }}>✓ Saved successfully</span>}
        </div>
      )}
    </div>
  );
}
