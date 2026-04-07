import React, { useEffect, useState } from 'react';
import { subscriptionsAPI } from '../api';
import toast from 'react-hot-toast';

const STATUS_COLORS = { active: 'badge-green', expired: 'badge-gray', cancelled: 'badge-red', grace_period: 'badge-yellow', pending: 'badge-blue' };

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('subscriptions'); // subscriptions | plans
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [revenue, setRevenue] = useState(null);
  const [planModal, setPlanModal] = useState({ open: false, data: null });
  const LIMIT = 20;

  useEffect(() => {
    fetchSubs();
    fetchPlans();
    fetchRevenue();
  }, [page, statusFilter]);

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await subscriptionsAPI.getAll(params);
      setSubs(data.data);
      setTotal(data.pagination?.total || 0);
    } catch { toast.error('Failed to load subscriptions'); }
    finally { setLoading(false); }
  };

  const fetchPlans = async () => {
    try {
      const { data } = await subscriptionsAPI.getPlans();
      setPlans(data.data);
    } catch {}
  };

  const fetchRevenue = async () => {
    try {
      const { data } = await subscriptionsAPI.getRevenue();
      setRevenue(data.data);
    } catch {}
  };

  const handleDeletePlan = async (id) => {
    if (!window.confirm('Deactivate this plan?')) return;
    try { await subscriptionsAPI.deletePlan(id); toast.success('Plan deactivated'); fetchPlans(); }
    catch { toast.error('Failed'); }
  };

  const handleSavePlan = async (formData) => {
    try {
      if (planModal.data) {
        await subscriptionsAPI.updatePlan(planModal.data._id, formData);
        toast.success('Plan updated');
      } else {
        await subscriptionsAPI.createPlan(formData);
        toast.success('Plan created');
      }
      setPlanModal({ open: false, data: null });
      fetchPlans();
    } catch { toast.error('Failed to save plan'); }
  };

  const totalRevenue = revenue?.monthly?.reduce((s, m) => s + m.total, 0) || 0;

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-sub">{total} total subscriptions</p>
        </div>
        {activeTab === 'plans' && (
          <button onClick={() => setPlanModal({ open: true, data: null })} className="btn-primary">
            <span>+</span> New Plan
          </button>
        )}
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: '💰', color: 'from-violet-600/20 to-purple-600/5' },
          { label: 'Active Subs', value: subs.filter(s => s.status === 'active').length, icon: '✅', color: 'from-emerald-600/20 to-emerald-600/5' },
          { label: 'Expiring Soon', value: subs.filter(s => s.status === 'grace_period').length, icon: '⏰', color: 'from-amber-600/20 to-amber-600/5' },
          { label: 'Plans Active', value: plans.filter(p => p.isActive).length, icon: '📋', color: 'from-blue-600/20 to-blue-600/5' },
        ].map((s, i) => (
          <div key={i} className={`card p-4 bg-gradient-to-br ${s.color} border-white/[0.07]`}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl w-fit border border-white/[0.06]">
        {['subscriptions', 'plans'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'subscriptions' ? (
        <>
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {['all', 'active', 'expired', 'cancelled', 'grace_period'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-violet-600/80 text-white' : 'bg-white/[0.05] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/[0.06]">
                  <tr>
                    {['Student', 'Plan', 'Status', 'Started', 'Expires', 'Amount', 'Method'].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <tr key={i} className="tr">
                        {[...Array(7)].map((_, j) => (
                          <td key={j} className="td"><div className="skeleton h-4" /></td>
                        ))}
                      </tr>
                    ))
                  ) : subs.map(sub => (
                    <tr key={sub._id} className="tr">
                      <td className="td">
                        <div>
                          <p className="font-medium text-white text-sm">{sub.user?.name || '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{sub.user?.email}</p>
                        </div>
                      </td>
                      <td className="td">
                        <span className="badge-purple">{sub.plan?.name || sub.plan?.type || '—'}</span>
                      </td>
                      <td className="td">
                        <span className={STATUS_COLORS[sub.status] || 'badge-gray'}>{sub.status}</span>
                      </td>
                      <td className="td text-gray-400">{sub.startDate ? new Date(sub.startDate).toLocaleDateString() : '—'}</td>
                      <td className="td text-gray-400">{sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '—'}</td>
                      <td className="td">
                        <span className="text-emerald-400 font-semibold">${sub.amountPaid || 0}</span>
                      </td>
                      <td className="td">
                        <span className="badge-gray capitalize">{sub.paymentMethod?.replace('_', ' ') || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > LIMIT && (
              <div className="flex items-center justify-between p-4 border-t border-white/[0.06]">
                <p className="text-xs text-gray-500">Showing {Math.min((page-1)*LIMIT+1,total)}-{Math.min(page*LIMIT,total)} of {total}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1.5 text-xs">← Prev</button>
                  <button onClick={() => setPage(p => p+1)} disabled={page*LIMIT>=total} className="btn-secondary px-3 py-1.5 text-xs">Next →</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Plans */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan._id} className={`card p-5 space-y-4 card-hover ${!plan.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="badge-purple capitalize">{plan.type}</span>
                {!plan.isActive && <span className="badge-red">Inactive</span>}
              </div>
              <div>
                <p className="text-3xl font-black text-white">${plan.price}</p>
                <p className="text-gray-400 font-semibold mt-1">{plan.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{plan.durationDays} days</p>
              </div>
              {plan.features?.length > 0 && (
                <ul className="space-y-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0"/>
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                <button onClick={() => setPlanModal({ open: true, data: plan })} className="btn-secondary flex-1 justify-center text-xs py-2">Edit</button>
                <button onClick={() => handleDeletePlan(plan._id)} className="btn-danger text-xs py-2 px-3">Delete</button>
              </div>
            </div>
          ))}
          <div
            onClick={() => setPlanModal({ open: true, data: null })}
            className="card p-5 border-dashed border-white/[0.1] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all min-h-[200px]"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-xl">+</div>
            <p className="text-sm font-medium text-gray-400">Add New Plan</p>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {planModal.open && <PlanModal plan={planModal.data} onClose={() => setPlanModal({ open: false, data: null })} onSave={handleSavePlan} />}
    </div>
  );
}

function PlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState({ name: plan?.name||'', type: plan?.type||'monthly', price: plan?.price||'', durationDays: plan?.durationDays||30, features: plan?.features?.join('\n')||'' });
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...form, price: parseFloat(form.price), durationDays: parseInt(form.durationDays), features: form.features.split('\n').filter(Boolean) }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in">
      <div className="bg-[#13131f] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h2 className="font-bold text-white">{plan ? 'Edit Plan' : 'New Plan'}</h2>
          <button onClick={onClose} className="btn-icon text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label className="label">Plan Name</label><input className="input" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Pro Monthly"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Type</label>
              <select className="select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
              </select>
            </div>
            <div><label className="label">Price ($)</label><input className="input" type="number" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="29.99"/></div>
          </div>
          <div><label className="label">Duration (Days)</label><input className="input" type="number" required value={form.durationDays} onChange={e=>setForm({...form,durationDays:e.target.value})}/></div>
          <div><label className="label">Features (one per line)</label><textarea className="textarea min-h-20" value={form.features} onChange={e=>setForm({...form,features:e.target.value})} placeholder="Access all courses&#10;HD streaming&#10;Mobile app"/></div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">{plan ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
