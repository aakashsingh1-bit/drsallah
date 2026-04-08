import React, { useEffect, useState } from 'react';
import { subscriptionsAPI } from '../api';
import toast from 'react-hot-toast';
import { IconSubscriptions, IconTrendUp, IconClock, IconCheckCircle, IconPlus, IconEdit, IconTrash } from '../components/Icons';

const STATUS = { active:'badge-green', expired:'badge-gray', cancelled:'badge-red', grace_period:'badge-yellow', pending:'badge-blue' };

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('subs');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [planModal, setPlanModal] = useState({ open: false, data: null });
  const LIMIT = 20;

  useEffect(() => { fetchAll(); }, [page, statusFilter]);
  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFilter !== 'all') params.status = statusFilter;
      const [s, p, r] = await Promise.all([subscriptionsAPI.getAll(params), subscriptionsAPI.getPlans(), subscriptionsAPI.getRevenue()]);
      setSubs(s.data.data); setTotal(s.data.pagination?.total || 0);
      setPlans(p.data.data); setRevenue(r.data.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const deletePlan = async (id) => {
    if (!window.confirm('Deactivate this plan?')) return;
    try { await subscriptionsAPI.deletePlan(id); toast.success('Plan deactivated'); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const savePlan = async (form) => {
    try {
      if (planModal.data) { await subscriptionsAPI.updatePlan(planModal.data._id, form); toast.success('Updated'); }
      else { await subscriptionsAPI.createPlan(form); toast.success('Created'); }
      setPlanModal({ open: false, data: null }); fetchAll();
    } catch { toast.error('Failed to save plan'); }
  };

  const totalRev = revenue?.monthly?.reduce((s,m) => s + (m.total||0), 0) || 0;

  return (
    <div className="page-wrap anim-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">{total} total subscriptions</p>
        </div>
        {tab === 'plans' && <button onClick={() => setPlanModal({ open: true, data: null })} className="btn-primary"><IconPlus className="w-4 h-4" />New Plan</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totalRev.toLocaleString()}`, Icon: IconTrendUp, bg: 'bg-emerald-500/12', color: 'text-emerald-400', border: 'border-emerald-500/15' },
          { label: 'Active', value: subs.filter(s=>s.status==='active').length, Icon: IconCheckCircle, bg: 'bg-indigo-500/12', color: 'text-indigo-400', border: 'border-indigo-500/15' },
          { label: 'Grace Period', value: subs.filter(s=>s.status==='grace_period').length, Icon: IconClock, bg: 'bg-amber-500/12', color: 'text-amber-400', border: 'border-amber-500/15' },
          { label: 'Plans Active', value: plans.filter(p=>p.isActive).length, Icon: IconSubscriptions, bg: 'bg-blue-500/12', color: 'text-blue-400', border: 'border-blue-500/15' },
        ].map((s, i) => (
          <div key={i} className={`card p-4 border ${s.border} bg-gradient-to-br ${s.bg.replace('/12','')}/[0.06] to-transparent`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
              <s.Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-[12px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl w-fit border border-white/[0.06]">
        {[['subs','Subscriptions'],['plans','Plans']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab===v ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-white'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'subs' ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {['all','active','expired','cancelled','grace_period'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${statusFilter===s ? 'bg-indigo-600/80 text-white' : 'bg-white/[0.04] text-gray-500 hover:text-white border border-white/[0.06]'}`}>
                {s.replace('_',' ')}
              </button>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/[0.05]">
                  <tr>
                    {['Student','Plan','Status','Period','Amount','Method'].map(h => <th key={h} className="tbl-head">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(8)].map((_,i) => <tr key={i}>{[...Array(6)].map((_,j) => <td key={j} className="tbl-cell"><div className="skeleton h-4 rounded" /></td>)}</tr>)
                  : subs.map(sub => (
                    <tr key={sub._id} className="tbl-row">
                      <td className="tbl-cell">
                        <p className="text-[13px] font-medium text-white">{sub.user?.name || '—'}</p>
                        <p className="text-[11px] text-gray-600">{sub.user?.email}</p>
                      </td>
                      <td className="tbl-cell"><span className="badge-purple capitalize text-[11px]">{sub.plan?.name || sub.plan?.type || '—'}</span></td>
                      <td className="tbl-cell"><span className={`${STATUS[sub.status] || 'badge-gray'} text-[11px]`}>{sub.status}</span></td>
                      <td className="tbl-cell text-[11px] text-gray-500">
                        <p>{sub.startDate ? new Date(sub.startDate).toLocaleDateString() : '—'}</p>
                        <p>{sub.endDate ? `→ ${new Date(sub.endDate).toLocaleDateString()}` : ''}</p>
                      </td>
                      <td className="tbl-cell"><span className="text-[13px] font-semibold text-emerald-400">${sub.amountPaid || 0}</span></td>
                      <td className="tbl-cell"><span className="badge-gray text-[10px] capitalize">{sub.paymentMethod?.replace('_',' ') || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > LIMIT && (
              <div className="flex items-center justify-between px-4 py-3.5 border-t border-white/[0.05]">
                <p className="text-[12px] text-gray-600">Showing {Math.min((page-1)*LIMIT+1,total)}–{Math.min(page*LIMIT,total)} of {total}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1.5 text-[12px]">Previous</button>
                  <button onClick={() => setPage(p=>p+1)} disabled={page*LIMIT>=total} className="btn-secondary px-3 py-1.5 text-[12px]">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan._id} className={`card p-5 space-y-4 card-hover ${!plan.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="badge-purple capitalize">{plan.type}</span>
                {!plan.isActive && <span className="badge-red">Inactive</span>}
              </div>
              <div>
                <p className="text-3xl font-black text-white">${plan.price}</p>
                <p className="text-[14px] font-semibold text-gray-300 mt-1">{plan.name}</p>
                <p className="text-[12px] text-gray-600 mt-0.5">{plan.durationDays} days</p>
              </div>
              {plan.features?.length > 0 && (
                <ul className="space-y-1.5">
                  {plan.features.map((f,i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-gray-500">
                      <IconCheckCircle className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 pt-2 border-t border-white/[0.05]">
                <button onClick={() => setPlanModal({ open: true, data: plan })} className="btn-secondary flex-1 justify-center text-[12px] py-2 gap-1.5"><IconEdit className="w-3.5 h-3.5" />Edit</button>
                <button onClick={() => deletePlan(plan._id)} className="btn-danger text-[12px] py-2 px-3"><IconTrash className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          <div onClick={() => setPlanModal({ open: true, data: null })} className="card p-5 border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] transition-all min-h-[200px]">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <IconPlus className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-[13px] font-medium text-gray-500">Add New Plan</p>
          </div>
        </div>
      )}

      {planModal.open && <PlanModal plan={planModal.data} onClose={() => setPlanModal({ open: false, data: null })} onSave={savePlan} />}
    </div>
  );
}

function PlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState({ name: plan?.name||'', type: plan?.type||'monthly', price: plan?.price||'', durationDays: plan?.durationDays||30, features: plan?.features?.join('\n')||'' });
  const s = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const submit = e => { e.preventDefault(); onSave({ ...form, price: parseFloat(form.price), durationDays: parseInt(form.durationDays), features: form.features.split('\n').filter(Boolean) }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm anim-fade-in">
      <div className="bg-[#111118] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl anim-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="font-bold text-white text-[15px]">{plan ? 'Edit Plan' : 'New Plan'}</h2>
          <button onClick={onClose} className="btn-icon text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div><label className="field-label">Plan Name</label><input name="name" className="field-input" required value={form.name} onChange={s} placeholder="e.g. Pro Monthly"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">Type</label>
              <select name="type" className="field-select" value={form.type} onChange={s}>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
              </select>
            </div>
            <div><label className="field-label">Price ($)</label><input name="price" type="number" step="0.01" className="field-input" required value={form.price} onChange={s} placeholder="29.99"/></div>
          </div>
          <div><label className="field-label">Duration (Days)</label><input name="durationDays" type="number" className="field-input" required value={form.durationDays} onChange={s}/></div>
          <div><label className="field-label">Features (one per line)</label><textarea name="features" className="field-textarea min-h-[80px]" value={form.features} onChange={s} placeholder="Access all courses&#10;HD streaming"/></div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">{plan ? 'Update Plan' : 'Create Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
