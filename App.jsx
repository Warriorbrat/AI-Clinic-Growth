import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, Users, MessageSquare, CalendarCheck, BarChart2,
  CreditCard, Settings, LogOut, Bell, Plus, Search,
  Phone, MessageCircle, Instagram, Globe, FileText,
  TrendingUp, CheckCircle2, AlertCircle, RefreshCw,
  Eye, StickyNote, Send, ChevronRight, Shield,
} from 'lucide-react';
import { useOverview, useFunnel, useRevenueSeries, useChannelBreakdown,
         useLeads, useConversations, useConversation, useAppointments,
         useSendReminder, useUpdateAppointment } from './hooks/useApi';
import { authApi } from './services/api';
import api from './services/api';

// ─── Styles ─────────────────────────────────────────────────────────────────
const S = document.createElement('style');
S.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080d18;--s1:#0f1623;--s2:#161f30;--b:#1c2a40;--acc:#00d4aa;--acc2:#3b82f6;--acc3:#f59e0b;--red:#ef4444;--warn:#f97316;--txt:#e2e8f0;--muted:#56687a;--font:'DM Sans',sans-serif;--head:'Syne',sans-serif}
body{background:var(--bg);color:var(--txt);font-family:var(--font);overflow-x:hidden}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--b);border-radius:2px}
.layout{display:flex;min-height:100vh}
.sidebar{width:230px;min-height:100vh;background:var(--s1);border-right:1px solid var(--b);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:40}
.s-logo{padding:22px 18px 18px;border-bottom:1px solid var(--b)}
.s-logo-t{font-family:var(--head);font-weight:800;font-size:16px;color:var(--acc)}
.s-logo-s{font-size:11px;color:var(--muted);margin-top:2px}
.s-nav{flex:1;padding:10px 0;overflow-y:auto}
.s-sec{padding:8px 14px 3px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);font-weight:600}
.nav-i{display:flex;align-items:center;gap:9px;padding:8px 18px;cursor:pointer;font-size:13.5px;color:var(--muted);border-left:2px solid transparent;transition:all .15s}
.nav-i:hover{color:var(--txt);background:var(--s2)}
.nav-i.active{color:var(--acc);background:rgba(0,212,170,.08);border-left-color:var(--acc);font-weight:500}
.s-bot{padding:14px;border-top:1px solid var(--b)}
.s-clinic{background:var(--s2);border-radius:8px;padding:10px 12px}
.s-cname{font-family:var(--head);font-weight:700;font-size:13px}
.s-plan{font-size:11px;color:var(--acc);margin-top:2px}
.main{margin-left:230px;flex:1;min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-bottom:1px solid var(--b);background:var(--s1);position:sticky;top:0;z-index:30}
.page-title{font-family:var(--head);font-size:19px;font-weight:700}
.tb-right{display:flex;align-items:center;gap:10px}
.ai-dot{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted)}
.ai-dot span{width:7px;height:7px;border-radius:50%;background:var(--acc);box-shadow:0 0 6px var(--acc);display:inline-block}
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .15s;font-family:var(--font)}
.btn-p{background:var(--acc);color:#080d18}.btn-p:hover{background:#00bfa0}
.btn-g{background:transparent;color:var(--muted);border:1px solid var(--b)}.btn-g:hover{color:var(--txt);border-color:var(--muted)}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-d{opacity:.5;cursor:not-allowed}
.content{padding:24px 28px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.kpi{background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:18px;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--kc,var(--acc))}
.kpi-lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.kpi-val{font-family:var(--head);font-size:30px;font-weight:800;margin:7px 0 3px;line-height:1;color:var(--kc,var(--txt))}
.kpi-sub{font-size:12px;color:var(--acc)}
.kpi-ico{position:absolute;top:14px;right:14px;opacity:.12}
.charts-grid{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:20px}
.card{background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:18px}
.card-t{font-family:var(--head);font-size:14px;font-weight:700;margin-bottom:14px}
.tbl-card{background:var(--s1);border:1px solid var(--b);border-radius:12px;overflow:hidden}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 18px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600;border-bottom:1px solid var(--b);background:var(--s2)}
td{padding:12px 18px;font-size:13.5px;border-bottom:1px solid rgba(28,42,64,.4);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--s2)}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}
.b-hot{background:rgba(239,68,68,.14);color:#ef4444}
.b-warm{background:rgba(245,158,11,.14);color:#f59e0b}
.b-cold{background:rgba(59,130,246,.14);color:#3b82f6}
.b-emergency{background:rgba(220,38,38,.2);color:#dc2626}
.b-new,.b-nurturing,.b-contacted{background:rgba(86,104,122,.2);color:#94a3b8}
.b-appointment_set,.b-confirmed{background:rgba(59,130,246,.14);color:#60a5fa}
.b-converted,.b-completed{background:rgba(0,212,170,.15);color:#00d4aa}
.b-lost,.b-cancelled{background:rgba(86,104,122,.15);color:#64748b}
.b-pending{background:rgba(245,158,11,.14);color:#f59e0b}
.b-no_show{background:rgba(239,68,68,.14);color:#ef4444}
.b-reminded_24h,.b-reminded_2h{background:rgba(59,130,246,.1);color:#60a5fa}
.b-voice{background:rgba(59,130,246,.14);color:#3b82f6}
.b-whatsapp{background:rgba(34,197,94,.14);color:#22c55e}
.b-instagram{background:rgba(236,72,153,.14);color:#ec4899}
.b-webchat{background:rgba(168,85,247,.14);color:#a855f7}
.b-form{background:rgba(245,158,11,.14);color:#f59e0b}
.srch{display:flex;align-items:center;gap:7px;background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:6px 11px}
.srch input{background:none;border:none;outline:none;color:var(--txt);font-size:13px;width:190px;font-family:var(--font)}
.srch input::placeholder{color:var(--muted)}
.sel{background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:6px 10px;font-size:13px;color:var(--txt);outline:none;cursor:pointer;font-family:var(--font)}
.sel option{background:var(--s2)}
.filter-row{display:flex;align-items:center;gap:9px;margin-bottom:14px;flex-wrap:wrap}
.empty{text-align:center;padding:50px 20px;color:var(--muted)}
.pag{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid var(--b);font-size:13px;color:var(--muted)}
.convo-list{display:flex;flex-direction:column}
.convo-i{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid var(--b);cursor:pointer;transition:background .1s}
.convo-i:hover,.convo-i.sel{background:var(--s2)}
.c-av{width:36px;height:36px;border-radius:50%;background:var(--s2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--head);font-weight:700;font-size:13px;color:var(--acc)}
.c-meta{flex:1;min-width:0}
.c-name{font-weight:600;font-size:13.5px;display:flex;align-items:center;justify-content:space-between}
.c-prev{font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-time{font-size:11px;color:var(--muted);flex-shrink:0}
.detail-panel{background:var(--s1);border:1px solid var(--b);border-radius:12px;height:calc(100vh - 130px);display:flex;flex-direction:column}
.detail-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}
.msg{max-width:75%;padding:9px 13px;border-radius:12px;font-size:13.5px;line-height:1.5}
.msg-user{background:var(--s2);align-self:flex-start;border-bottom-left-radius:3px}
.msg-assistant{background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.2);align-self:flex-end;border-bottom-right-radius:3px}
.msg-wrap{display:flex;flex-direction:column}
.msg-wrap.user{align-items:flex-start}.msg-wrap.assistant{align-items:flex-end}
.msg-ts{font-size:10px;color:var(--muted);margin-top:3px}
.funnel-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--b)}
.funnel-row:last-child{border-bottom:none}
.funnel-bar-wrap{flex:1;background:var(--s2);border-radius:3px;height:7px;overflow:hidden}
.funnel-bar{height:100%;border-radius:3px;transition:width .8s ease}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)}
.login-card{background:var(--s1);border:1px solid var(--b);border-radius:16px;padding:38px;width:370px}
.input{width:100%;background:var(--s2);border:1px solid var(--b);border-radius:8px;padding:9px 13px;font-size:14px;color:var(--txt);outline:none;font-family:var(--font);transition:border-color .15s}
.input:focus{border-color:var(--acc)}
.label{font-size:12.5px;color:var(--muted);display:block;margin-bottom:5px;font-weight:500}
.tabs{display:flex;gap:3px;background:var(--s2);padding:3px;border-radius:9px;width:fit-content;margin-bottom:18px}
.tab{padding:6px 13px;border-radius:7px;font-size:13px;cursor:pointer;color:var(--muted);border:none;background:none;font-family:var(--font);transition:all .15s}
.tab.active{background:var(--s1);color:var(--txt);font-weight:600}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp .28s ease}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
`;
document.head.appendChild(S);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true}) : '—';
const fmtTime = d => d ? new Date(d).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}) : '—';
const initials = n => (n||'P').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const chIcon = c => ({voice:<Phone size={11}/>,whatsapp:<MessageCircle size={11}/>,instagram:<Instagram size={11}/>,webchat:<Globe size={11}/>,form:<FileText size={11}/>}[c]||<MessageSquare size={11}/>);
const chColor = c => ({whatsapp:'#22c55e',voice:'#3b82f6',instagram:'#ec4899',webchat:'#a855f7',form:'#f59e0b'}[c]||'#64748b');

const Badge = ({val,type='status'}) => {
  const s = val?.toLowerCase().replace(' ','_') || 'new';
  return <span className={`badge b-${s}`}>{type==='channel' && chIcon(s)} {val?.replace('_',' ')}</span>;
};
const Spinner = () => <span className="spinner"/>;

// ─── Login ────────────────────────────────────────────────────────────────────
const Login = ({onLogin}) => {
  const [f, setF] = useState({email:'',password:''});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await authApi.login(f);
      const {clinic,token} = res.data.data;
      localStorage.setItem('acgs_token', token);
      localStorage.setItem('acgs_clinic', JSON.stringify(clinic));
      onLogin(clinic);
    } catch (err) {
      setErr(err.response?.data?.message || 'Login failed. Check credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-card fu">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:8}}>🏥</div>
          <div style={{fontFamily:'var(--head)',fontWeight:800,fontSize:22,marginBottom:4}}>AI Clinic Growth</div>
          <div style={{color:'var(--muted)',fontSize:14}}>Sign in to your dashboard</div>
        </div>
        <form onSubmit={handle}>
          <div style={{marginBottom:14}}>
            <label className="label">Email</label>
            <input className="input" type="email" value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} required placeholder="admin@clinic.com"/>
          </div>
          <div style={{marginBottom:6}}>
            <label className="label">Password</label>
            <input className="input" type="password" value={f.password} onChange={e=>setF(p=>({...p,password:e.target.value}))} required placeholder="••••••••"/>
          </div>
          {err && <div style={{color:'var(--red)',fontSize:13,margin:'8px 0'}}>{err}</div>}
          <button type="submit" className="btn btn-p" style={{width:'100%',justifyContent:'center',padding:11,marginTop:12}} disabled={loading}>
            {loading ? <Spinner/> : 'Sign in'}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:12,color:'var(--muted)'}}>
          <a href="/pricing.html" style={{color:'var(--acc)',textDecoration:'none'}}>View Pricing →</a>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [period, setPeriod] = useState('month');
  const { data: ov,  isLoading: l1 } = useOverview(period);
  const { data: rev, isLoading: l2 } = useRevenueSeries();
  const { data: ch,  isLoading: l3 } = useChannelBreakdown(period);
  const { data: fn,  isLoading: l4 } = useFunnel(period);

  const kpis = ov ? [
    {label:'Total Leads',         val: ov.leads?.total||0,                   sub:`${ov.leads?.hot||0} hot leads`,          color:'var(--acc2)', icon:<Users size={32}/>},
    {label:'Appointments Booked', val: ov.leads?.booked||0,                  sub:`${ov.leads?.conversionRate||0}% conv rate`, color:'var(--acc)',  icon:<CalendarCheck size={32}/>},
    {label:'Patients Showed Up',  val: ov.appointments?.completed||0,         sub:`${ov.appointments?.showRate||0}% show rate`, color:'#22c55e', icon:<CheckCircle2 size={32}/>},
    {label:'Revenue Generated',   val:`₹${((ov.revenue?.generated||0)/1000).toFixed(1)}K`, sub:'This period', color:'var(--acc3)', icon:<TrendingUp size={32}/>},
  ] : [];

  return (
    <div className="content fu">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <h2 style={{fontFamily:'var(--head)',fontWeight:800,fontSize:21}}>Welcome back 👋</h2>
          <div style={{color:'var(--muted)',fontSize:13,marginTop:2}}>Here's how your clinic is performing.</div>
        </div>
        <div className="tabs" style={{marginBottom:0}}>
          {['today','week','month'].map(p=><button key={p} className={`tab${period===p?' active':''}`} onClick={()=>setPeriod(p)}>{p[0].toUpperCase()+p.slice(1)}</button>)}
        </div>
      </div>

      <div className="kpi-grid">
        {(l1 ? Array(4).fill(null) : kpis).map((k,i) => (
          <div key={i} className="kpi" style={k?{'--kc':k.color}:{}}>
            {k ? <>
              <div className="kpi-ico">{k.icon}</div>
              <div className="kpi-lbl">{k.label}</div>
              <div className="kpi-val">{k.val}</div>
              <div className="kpi-sub">{k.sub}</div>
            </> : <div style={{height:80,background:'var(--s2)',borderRadius:6,animation:'fadeUp 1.5s infinite'}}/>}
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-t">Revenue (Last 30 Days)</div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={rev||[]}>
              <XAxis dataKey="date" stroke="var(--b)" tick={{fill:'var(--muted)',fontSize:11}}/>
              <YAxis stroke="var(--b)" tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={v=>`₹${v/1000}K`}/>
              <Tooltip contentStyle={{background:'var(--s1)',border:'1px solid var(--b)',borderRadius:8,fontSize:12}} formatter={v=>[`₹${v?.toLocaleString?.()}`,'Revenue']}/>
              <Line type="monotone" dataKey="revenue" stroke="var(--acc)" strokeWidth={2.5} dot={false} activeDot={{r:4,fill:'var(--acc)'}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-t">Channels</div>
          {(ch||[]).map((c,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                <span style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:chColor(c.channel),display:'inline-block'}}/>
                  {c.channel}
                </span>
                <span style={{color:'var(--muted)'}}>{c.total} · <span style={{color:'var(--acc)'}}>{c.conversion_rate}%</span></span>
              </div>
              <div className="funnel-bar-wrap"><div className="funnel-bar" style={{width:`${(c.conversion_rate||0)*4}%`,background:chColor(c.channel)}}/></div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div className="card">
          <div className="card-t">Conversion Funnel</div>
          {(fn?.funnel||[]).map((f,i)=>(
            <div key={i} className="funnel-row">
              <div style={{fontSize:12.5,width:175,flexShrink:0}}>{f.stage}</div>
              <div className="funnel-bar-wrap"><div className="funnel-bar" style={{width:`${f.pct}%`,background:['#3b82f6','#f59e0b','#00d4aa','#22c55e'][i],opacity:1-i*.1}}/></div>
              <div style={{fontFamily:'var(--head)',fontWeight:700,fontSize:15,width:45,textAlign:'right'}}>{f.count}</div>
              <div style={{fontSize:12,color:'var(--muted)',width:38,textAlign:'right'}}>{f.pct}%</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-t">Lead Status</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={[{name:'Hot',value:ov?.leads?.hot||0,fill:'#ef4444'},{name:'Warm',value:ov?.leads?.warm||0,fill:'#f59e0b'},{name:'Cold',value:ov?.leads?.cold||0,fill:'#3b82f6'},{name:'Booked',value:ov?.leads?.booked||0,fill:'#00d4aa'}]} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                {[0,1,2,3].map(i=><Cell key={i}/>)}
              </Pie>
              <Tooltip contentStyle={{background:'var(--s1)',border:'1px solid var(--b)',borderRadius:8,fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ─── Leads ────────────────────────────────────────────────────────────────────
const Leads = () => {
  const [filters, setFilters] = useState({page:1,limit:20,status:'',channel:'',search:''});
  const { data, isLoading }   = useLeads(filters);
  const leads = data?.data || data?.leads || [];
  const total = data?.pagination?.total || 0;

  return (
    <div className="content fu">
      <div className="filter-row">
        <div className="srch"><Search size={13} color="var(--muted)"/><input placeholder="Search name or phone…" value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value,page:1}))}/></div>
        <select className="sel" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value,page:1}))}>
          <option value="">All Statuses</option>
          {['new','hot','warm','cold','emergency','appointment_set','converted','lost'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select className="sel" value={filters.channel} onChange={e=>setFilters(f=>({...f,channel:e.target.value,page:1}))}>
          <option value="">All Channels</option>
          {['voice','whatsapp','instagram','webchat','form'].map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{color:'var(--muted)',fontSize:13,marginLeft:'auto'}}>{total} leads</span>
      </div>
      <div className="tbl-card">
        <table>
          <thead><tr><th>Patient</th><th>Channel</th><th>Treatment</th><th>Status</th><th>Score</th><th>Last Contact</th><th></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7}><div className="empty"><Spinner/></div></td></tr>
            : leads.length === 0 ? <tr><td colSpan={7}><div className="empty">No leads found</div></td></tr>
            : leads.map(l=>(
              <tr key={l.id||l._id}>
                <td><div style={{fontWeight:600}}>{l.name||'Unknown'}</div><div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{l.phone}</div></td>
                <td><Badge val={l.channel} type="channel"/></td>
                <td style={{color:'var(--muted)',fontSize:13}}>{l.treatment_interest||l.qualification?.treatmentInterest||'—'}</td>
                <td><Badge val={l.status}/></td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <svg width={28} height={28}><circle cx={14} cy={14} r={12} fill="none" stroke="var(--s2)" strokeWidth={3}/><circle cx={14} cy={14} r={12} fill="none" stroke="var(--acc)" strokeWidth={3} strokeDasharray={`${(l.score||0)*0.754} 75.4`} transform="rotate(-90 14 14)"/></svg>
                    <span style={{fontSize:12,fontWeight:600}}>{l.score||0}</span>
                  </div>
                </td>
                <td style={{fontSize:12,color:'var(--muted)'}}>{fmtDate(l.last_contact_at||l.lastContactAt)}</td>
                <td><button className="btn btn-g btn-sm"><Eye size={11}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pag"><span>Showing {leads.length} of {total}</span></div>
      </div>
    </div>
  );
};

// ─── Conversations ────────────────────────────────────────────────────────────
const Conversations = () => {
  const { data }     = useConversations({ limit:30 });
  const convList     = data?.conversations || data?.data || [];
  const [selId, setSelId] = useState(null);
  const { data: selConv } = useConversation(selId);
  const selected = selConv || (selId ? convList.find(c=>(c.id||c._id)===selId) : convList[0]);

  return (
    <div className="content fu" style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:14,height:'calc(100vh - 120px)'}}>
      <div className="tbl-card" style={{overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'10px 14px',borderBottom:'1px solid var(--b)',fontFamily:'var(--head)',fontWeight:700,fontSize:13.5}}>
          Active Conversations <span style={{color:'var(--acc)',fontSize:13}}>({convList.length})</span>
        </div>
        <div style={{overflow:'auto',flex:1}}>
          {convList.map(c => {
            const id = c.id||c._id;
            const msgs = c.messages||[];
            const last = msgs[msgs.length-1];
            const lead = c.lead||c.leadId||{};
            return (
              <div key={id} className={`convo-i${(selId||((convList[0]?.id||convList[0]?._id)))===id?' sel':''}`} onClick={()=>setSelId(id)}>
                <div className="c-av">{initials(lead.name)}</div>
                <div className="c-meta">
                  <div className="c-name"><span>{lead.name||'Unknown'}</span><span className="c-time">{fmtTime(c.updated_at||c.updatedAt)}</span></div>
                  <div style={{display:'flex',gap:5,marginTop:3}}><Badge val={lead.channel} type="channel"/><Badge val={c.stage||c.context?.stage}/></div>
                  <div className="c-prev">{last?.content||'…'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="detail-panel">
          <div style={{padding:'12px 18px',borderBottom:'1px solid var(--b)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontFamily:'var(--head)',fontWeight:700}}>{(selected.lead||selected.leadId||{}).name||'Patient'}</div>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Stage: {selected.stage||selected.context?.stage||'greeting'}</div>
            </div>
            <Badge val={(selected.lead||selected.leadId||{}).status||'active'}/>
          </div>
          <div className="detail-msgs">
            {(selected.messages||[]).map((m,i)=>(
              <div key={i} className={`msg-wrap ${m.role}`}>
                <div className={`msg msg-${m.role}`}>{m.content}</div>
                <div className="msg-ts">{m.role==='assistant'?'🤖 AI':'👤 Patient'} · {fmtTime(m.timestamp)}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'10px 14px',borderTop:'1px solid var(--b)',display:'flex',gap:7}}>
            <input className="input" placeholder="Type a staff message…" style={{flex:1}}/>
            <button className="btn btn-p btn-sm"><Send size={12}/></button>
          </div>
        </div>
      ) : <div style={{display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>Select a conversation</div>}
    </div>
  );
};

// ─── Appointments ─────────────────────────────────────────────────────────────
const Appointments = () => {
  const [filters, setFilters] = useState({page:1,limit:20,status:''});
  const { data, isLoading }   = useAppointments(filters);
  const updateAppt            = useUpdateAppointment();
  const sendReminder          = useSendReminder();
  const appts = data?.appointments || data?.data || [];

  return (
    <div className="content fu">
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
        {[
          {label:'Pending',   val: appts.filter(a=>a.status==='pending').length,   color:'var(--acc3)'},
          {label:'Confirmed', val: appts.filter(a=>a.status==='confirmed').length,  color:'var(--acc)'},
          {label:'Completed', val: appts.filter(a=>a.status==='completed').length,  color:'#22c55e'},
          {label:'No Shows',  val: appts.filter(a=>a.status==='no_show').length,    color:'var(--red)'},
        ].map((s,i)=>(
          <div key={i} className="kpi" style={{'--kc':s.color}}>
            <div className="kpi-lbl">{s.label}</div>
            <div className="kpi-val" style={{fontSize:26}}>{s.val}</div>
          </div>
        ))}
      </div>
      <div className="filter-row">
        <select className="sel" value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
          <option value="">All Statuses</option>
          {['pending','confirmed','completed','no_show','cancelled'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <button className="btn btn-p btn-sm" style={{marginLeft:'auto'}}><Plus size={13}/> New</button>
      </div>
      <div className="tbl-card">
        <table>
          <thead><tr><th>Patient</th><th>Treatment</th><th>Date & Time</th><th>Status</th><th>Code</th><th>Actions</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6}><div className="empty"><Spinner/></div></td></tr>
            : appts.map(a=>(
              <tr key={a.id||a._id}>
                <td><div style={{fontWeight:600}}>{a.patient_name||a.patientName}</div><div style={{fontSize:11,color:'var(--muted)'}}>{a.phone}</div></td>
                <td style={{fontSize:13,color:'var(--muted)'}}>{a.treatment||'—'}</td>
                <td style={{fontSize:13}}>{fmtDate(a.scheduled_at||a.scheduledAt)}</td>
                <td><Badge val={a.status}/></td>
                <td><code style={{fontSize:11,background:'var(--s2)',padding:'2px 6px',borderRadius:4}}>{a.confirmation_code||a.confirmationCode}</code></td>
                <td>
                  <div style={{display:'flex',gap:5}}>
                    {['pending','confirmed','reminded_24h','reminded_2h'].includes(a.status) && (
                      <button className="btn btn-g btn-sm" onClick={()=>sendReminder.mutate(a.id||a._id)}><Bell size={11}/></button>
                    )}
                    {a.status==='pending' && (
                      <button className="btn btn-p btn-sm" onClick={()=>updateAppt.mutate({id:a.id||a._id,data:{status:'confirmed'}})}>Confirm</button>
                    )}
                    {a.status==='no_show' && (
                      <button className="btn btn-g btn-sm" style={{color:'var(--acc)'}}><RefreshCw size={11}/> Recover</button>
                    )}
                    {a.status==='completed' && a.revenue && (
                      <span style={{fontSize:12,color:'#22c55e',fontWeight:600}}>₹{Number(a.revenue)?.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Analytics ────────────────────────────────────────────────────────────────
const Analytics = () => {
  const { data: ov } = useOverview('month');
  const { data: rev} = useRevenueSeries();
  const { data: ch } = useChannelBreakdown('month');
  const { data: fn } = useFunnel('month');

  return (
    <div className="content fu">
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        {[
          {label:'Lead → Booking Rate',  val:`${ov?.leads?.conversionRate||0}%`,   color:'var(--acc)'},
          {label:'Appointment Show Rate',val:`${ov?.appointments?.showRate||0}%`,   color:'#22c55e'},
          {label:'No-Show Recovery',     val:'31%',                                 color:'var(--acc3)'},
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{'--kc':k.color}}>
            <div className="kpi-lbl">{k.label}</div>
            <div className="kpi-val" style={{fontSize:26}}>{k.val}</div>
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div className="card">
          <div className="card-t">Revenue (₹)</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={rev||[]} barSize={16}>
              <XAxis dataKey="date" stroke="var(--b)" tick={{fill:'var(--muted)',fontSize:11}}/>
              <YAxis stroke="var(--b)" tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={v=>`₹${v/1000}K`}/>
              <Tooltip contentStyle={{background:'var(--s1)',border:'1px solid var(--b)',borderRadius:8,fontSize:12}} formatter={v=>[`₹${v?.toLocaleString?.()}`]}/>
              <Bar dataKey="revenue" fill="var(--acc)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-t">Channel Conversion</div>
          {(ch||[]).map((c,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:13}}>
              <span style={{width:75,fontSize:13,color:'var(--muted)',display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:chColor(c.channel),display:'inline-block'}}/>{c.channel}
              </span>
              <div style={{flex:1,background:'var(--s2)',borderRadius:3,height:9,overflow:'hidden'}}>
                <div style={{width:`${(c.conversion_rate||0)*4}%`,height:'100%',background:chColor(c.channel),borderRadius:3}}/>
              </div>
              <span style={{fontSize:12,color:'var(--acc)',fontWeight:600,width:36,textAlign:'right'}}>{c.conversion_rate}%</span>
            </div>
          ))}
        </div>
        <div className="card" style={{gridColumn:'1/-1'}}>
          <div className="card-t">Full Conversion Funnel</div>
          {(fn?.funnel||[]).map((f,i)=>(
            <div key={i} className="funnel-row">
              <div style={{fontSize:13,width:185}}>{f.stage}</div>
              <div className="funnel-bar-wrap"><div className="funnel-bar" style={{width:`${f.pct}%`,background:['#3b82f6','#f59e0b','#00d4aa','#22c55e'][i],opacity:1-i*.1}}/></div>
              <div style={{fontFamily:'var(--head)',fontWeight:700,fontSize:16,width:50,textAlign:'right'}}>{f.count}</div>
              <div style={{fontSize:12,color:'var(--muted)',width:40,textAlign:'right'}}>{f.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Settings (lazy import) ────────────────────────────────────────────────────
const SettingsPage = React.lazy(() => import('./pages/Settings'));
const BillingPage  = React.lazy(() => import('./pages/Billing'));

// ─── App Shell ────────────────────────────────────────────────────────────────
const PAGES = [
  {id:'dashboard',     label:'Dashboard',     icon:<LayoutDashboard size={15}/>, C:Dashboard},
  {id:'leads',         label:'Leads',         icon:<Users size={15}/>,           C:Leads},
  {id:'conversations', label:'Conversations', icon:<MessageSquare size={15}/>,   C:Conversations},
  {id:'appointments',  label:'Appointments',  icon:<CalendarCheck size={15}/>,   C:Appointments},
  {id:'analytics',     label:'Analytics',     icon:<BarChart2 size={15}/>,       C:Analytics},
];

export default function App() {
  const [clinic, setClinic] = useState(() => {
    try { return JSON.parse(localStorage.getItem('acgs_clinic')||'null'); } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');

  if (!clinic) return <Login onLogin={c=>{setClinic(c);setPage('dashboard');}}/>;

  const ActivePage = PAGES.find(p=>p.id===page)?.C
    || (page==='settings' ? SettingsPage : page==='billing' ? BillingPage : Dashboard);
  const pageLabel  = PAGES.find(p=>p.id===page)?.label
    || (page==='settings'?'Settings':page==='billing'?'Billing':'Dashboard');

  const logout = () => {
    localStorage.removeItem('acgs_token');
    localStorage.removeItem('acgs_clinic');
    setClinic(null);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="s-logo">
          <div className="s-logo-t">🏥 AI Clinic Growth</div>
          <div className="s-logo-s">v2.0 — Production</div>
        </div>
        <nav className="s-nav">
          <div className="s-sec">Operations</div>
          {PAGES.map(p=>(
            <div key={p.id} className={`nav-i${page===p.id?' active':''}`} onClick={()=>setPage(p.id)}>
              {p.icon} {p.label}
            </div>
          ))}
          <div className="s-sec" style={{marginTop:10}}>Account</div>
          <div className={`nav-i${page==='billing'?' active':''}`} onClick={()=>setPage('billing')}><CreditCard size={15}/> Billing</div>
          <div className={`nav-i${page==='settings'?' active':''}`} onClick={()=>setPage('settings')}><Settings size={15}/> Settings</div>
        </nav>
        <div className="s-bot">
          <div className="s-clinic">
            <div className="s-cname">{clinic.name}</div>
            <div className="s-plan">✦ {clinic.subscription_plan||'Starter'} Plan</div>
          </div>
          <div className="nav-i" style={{marginTop:8}} onClick={logout}><LogOut size={13}/><span style={{fontSize:13}}>Sign out</span></div>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="page-title">{pageLabel}</div>
          <div className="tb-right">
            <div className="ai-dot"><span/>AI Active</div>
            <button className="btn btn-g btn-sm"><Bell size={13}/></button>
            <button className="btn btn-p btn-sm" onClick={()=>setPage('appointments')}><Plus size={13}/> Quick Book</button>
          </div>
        </div>
        <React.Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--muted)'}}><Spinner/></div>}>
          <ActivePage clinic={clinic}/>
        </React.Suspense>
      </main>
    </div>
  );
}
