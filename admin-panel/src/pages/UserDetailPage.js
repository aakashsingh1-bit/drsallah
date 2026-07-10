import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI, coursesAPI, purchasesAPI } from '../api';
import toast from 'react-hot-toast';
import {
  IconChevronRight, IconSecurity, IconDevice, IconAlertTriangle,
  IconAlertCircle, IconCheckCircle, IconClock, IconGlobe, IconCalendar,
  IconCourses, IconPlus,
} from '../components/Icons';

const EVENT_ICONS = {
  login_success: <IconCheckCircle className="w-4 h-4 text-emerald-400" />,
  login_failed: <IconAlertCircle className="w-4 h-4 text-rose-400" />,
  logout: <IconChevronRight className="w-4 h-4 text-gray-400" />,
  screen_record_attempt: <IconAlertTriangle className="w-4 h-4 text-rose-400" />,
  screenshot_attempt: <IconAlertTriangle className="w-4 h-4 text-rose-400" />,
  suspicious_activity: <IconAlertCircle className="w-4 h-4 text-amber-400" />,
  session_terminated: <IconSecurity className="w-4 h-4 text-amber-400" />,
  piracy_attempt: <IconAlertTriangle className="w-4 h-4 text-rose-400" />,
  multi_device_login: <IconDevice className="w-4 h-4 text-orange-400" />,
  playback_started: <IconCheckCircle className="w-4 h-4 text-blue-400" />,
  subscription_expired: <IconAlertCircle className="w-4 h-4 text-amber-400" />,
  account_suspended: <IconSecurity className="w-4 h-4 text-rose-400" />,
  course_purchase_activated: <IconCheckCircle className="w-4 h-4 text-emerald-400" />,
};

const statusBadge = (status, endDate) => {
  const expired = status === 'active' && endDate && new Date(endDate) < new Date();
  if (expired) return <span className="badge-gray">Expired</span>;
  if (status === 'active') return <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Active</span>;
  if (status === 'pending') return <span className="badge-yellow">Pending</span>;
  if (status === 'failed') return <span className="badge-red">Failed</span>;
  return <span className="badge-gray capitalize">{status}</span>;
};

export default function UserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [granting, setGranting] = useState(false);
  const [activatingId, setActivatingId] = useState(null);
  const [form, setForm] = useState({
    courseId: '',
    months: 1,
    amountPaid: '',
    currency: 'AED',
    note: '',
    stripePaymentIntentId: '',
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const { data: d } = await usersAPI.getById(id);
      setData(d.data);
    } catch {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [id]);

  useEffect(() => {
    coursesAPI.getAll({ limit: 100 })
      .then(({ data: d }) => setCourses(d.data || []))
      .catch(() => {});
  }, []);

  const suspend = async () => {
    const r = window.prompt('Reason for suspension?');
    if (!r) return;
    try { await usersAPI.suspend(id, r); toast.success('Suspended'); fetch(); }
    catch { toast.error('Failed'); }
  };
  const unsuspend = async () => {
    try { await usersAPI.unsuspend(id); toast.success('Unsuspended'); fetch(); }
    catch { toast.error('Failed'); }
  };
  const forceLogout = async () => {
    try { await usersAPI.forceLogout(id); toast.success('All sessions revoked'); }
    catch { toast.error('Failed'); }
  };
  const resetDevice = async () => {
    if (!window.confirm('Reset device binding?')) return;
    try { await usersAPI.resetDevice(id); toast.success('Device reset'); fetch(); }
    catch { toast.error('Failed'); }
  };

  const selectedCourse = courses.find((c) => c._id === form.courseId);
  const tiers = (selectedCourse?.priceTiers || []).filter((t) => t.isActive !== false);

  useEffect(() => {
    if (!selectedCourse) return;
    if (tiers.length) {
      const tier = tiers.find((t) => Number(t.months) === Number(form.months)) || tiers[0];
      setForm((f) => ({
        ...f,
        months: Number(tier.months),
        amountPaid: f.amountPaid === '' ? String(tier.price ?? '') : f.amountPaid,
        currency: tier.currency || f.currency || 'AED',
      }));
    }
  }, [form.courseId]);

  const grantCourse = async (e) => {
    e.preventDefault();
    if (!form.courseId || !form.months) {
      toast.error('Select a course and duration');
      return;
    }
    if (!window.confirm('Activate course access for this student? Use this when Stripe payment succeeded but webhook failed.')) {
      return;
    }
    setGranting(true);
    try {
      await usersAPI.grantCourse(id, {
        courseId: form.courseId,
        months: Number(form.months),
        amountPaid: form.amountPaid === '' ? undefined : Number(form.amountPaid),
        currency: form.currency || 'AED',
        note: form.note || undefined,
        stripePaymentIntentId: form.stripePaymentIntentId || undefined,
      });
      toast.success('Course access activated');
      setGrantOpen(false);
      setForm({ courseId: '', months: 1, amountPaid: '', currency: 'AED', note: '', stripePaymentIntentId: '' });
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate course');
    } finally {
      setGranting(false);
    }
  };

  const activatePurchase = async (purchaseId) => {
    if (!window.confirm('Activate this pending purchase now?')) return;
    setActivatingId(purchaseId);
    try {
      await purchasesAPI.activate(purchaseId, { note: 'Activated from user detail (webhook recovery)' });
      toast.success('Purchase activated');
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate');
    } finally {
      setActivatingId(null);
    }
  };

  if (loading) return (
    <div className="page-wrap space-y-4">
      {[...Array(4)].map((_,i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
    </div>
  );

  const { user, recentLogs, purchases } = data || {};
  if (!user) return null;

  return (
    <div className="page-wrap animate-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px]">
        <Link to="/users" className="text-[#6a6f73] hover:text-[#1c1d1f] transition-colors">Students</Link>
        <IconChevronRight className="w-3.5 h-3.5 text-[#b0afab]" />
        <span className="text-[#1c1d1f]">{user.name}</span>
      </div>

      {/* Profile */}
      <div className="card p-6 flex flex-col sm:flex-row items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center text-xl font-black text-white shadow-xl shadow-brand-500/20 flex-shrink-0">
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[#1c1d1f]">{user.name}</h1>
            {user.isSuspended ? <span className="badge-red"><IconSecurity className="w-3 h-3" />Suspended</span>
              : user.isFlagged ? <span className="badge-yellow"><IconAlertTriangle className="w-3 h-3" />Flagged</span>
              : <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Active</span>}
            {!user.isVerified && <span className="badge-gray">Unverified</span>}
          </div>
          <p className="text-[13px] text-[#6a6f73]">{user.email}</p>
          {user.phone && <p className="text-[13px] text-[#9e9e9e] mt-0.5">{user.phone}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-[#9e9e9e]">
            <span className="flex items-center gap-1.5"><IconCalendar className="w-3.5 h-3.5" />Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            {user.lastLogin && <span className="flex items-center gap-1.5"><IconClock className="w-3.5 h-3.5" />Last login {new Date(user.lastLogin).toLocaleDateString()}</span>}
            {user.lastLoginIp && <span className="flex items-center gap-1.5"><IconGlobe className="w-3.5 h-3.5" />{user.lastLoginIp}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.isSuspended
            ? <button onClick={unsuspend} className="btn-success text-[12px] py-2 px-3.5"><IconCheckCircle className="w-3.5 h-3.5" />Unsuspend</button>
            : <button onClick={suspend} className="btn-danger text-[12px] py-2 px-3.5"><IconSecurity className="w-3.5 h-3.5" />Suspend</button>
          }
          <button onClick={forceLogout} className="btn-secondary text-[12px] py-2 px-3.5">Logout All</button>
          {user.deviceId && <button onClick={resetDevice} className="btn-secondary text-[12px] py-2 px-3.5"><IconDevice className="w-3.5 h-3.5" />Reset Device</button>}
          <button onClick={() => setGrantOpen(true)} className="btn-primary text-[12px] py-2 px-3.5">
            <IconPlus className="w-3.5 h-3.5" />Activate Course
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-bold text-[#6a6f73] uppercase tracking-widest mb-4">Subscription</p>
          {user.activeSubscription ? (
            <div className="space-y-1.5">
              <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Active</span>
              <p className="text-[16px] font-bold text-[#1c1d1f] mt-2 capitalize">{user.activeSubscription.plan?.name || user.activeSubscription.plan?.type || 'Plan'}</p>
              <p className="text-[12px] text-[#9e9e9e]">Expires {user.activeSubscription.endDate ? new Date(user.activeSubscription.endDate).toLocaleDateString() : '—'}</p>
            </div>
          ) : <p className="text-[13px] text-[#9e9e9e]">No active subscription</p>}
        </div>

        <div className="card p-5">
          <p className="text-[10px] font-bold text-[#6a6f73] uppercase tracking-widest mb-4">Device Binding</p>
          {user.deviceId ? (
            <div className="space-y-1.5">
              <span className="badge-blue"><IconDevice className="w-3 h-3" />Bound</span>
              <p className="text-[13px] font-semibold text-[#1c1d1f] mt-2">{user.deviceName || 'Unknown Device'}</p>
              <p className="text-[10px] text-[#9e9e9e] font-mono break-all">{user.deviceId.substring(0, 32)}...</p>
              {user.deviceBoundAt && <p className="text-[11px] text-[#6a6f73]">Bound {new Date(user.deviceBoundAt).toLocaleDateString()}</p>}
            </div>
          ) : <p className="text-[13px] text-[#9e9e9e]">No device bound</p>}
        </div>

        <div className="card p-5">
          <p className="text-[10px] font-bold text-[#6a6f73] uppercase tracking-widest mb-4">Risk Score</p>
          <p className={`text-4xl font-black leading-none ${user.riskScore >= 60 ? 'text-red-600' : user.riskScore >= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {user.riskScore || 0}
          </p>
          <div className="h-2 bg-[#f0ece4] rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all ${user.riskScore >= 60 ? 'bg-red-500' : user.riskScore >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${user.riskScore}%` }}
            />
          </div>
          <p className="text-[11px] text-[#6a6f73] mt-2">
            {user.riskScore >= 60 ? 'High risk — action recommended' : user.riskScore >= 30 ? 'Medium risk — monitor closely' : 'Low risk — normal behavior'}
          </p>
          {user.flagReason && <p className="text-[11px] text-amber-600 mt-1.5">{user.flagReason}</p>}
        </div>
      </div>

      {/* Course purchases */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#e8e6e0] flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-[#1c1d1f]">Course Access</p>
            <p className="text-[12px] text-[#6a6f73] mt-0.5">Purchases and manual activations</p>
          </div>
          <button onClick={() => setGrantOpen(true)} className="btn-secondary text-[12px] py-2 px-3">
            <IconPlus className="w-3.5 h-3.5" />Grant access
          </button>
        </div>
        <div className="divide-y divide-[#f0ece4]">
          {(purchases || []).length === 0 ? (
            <div className="text-center py-10 px-4">
              <IconCourses className="w-8 h-8 text-[#d1d0cc] mx-auto mb-2" />
              <p className="text-[13px] text-[#9e9e9e]">No course purchases yet</p>
              <p className="text-[12px] text-[#b0afab] mt-1">If Stripe paid but access is missing, use Activate Course</p>
            </div>
          ) : (purchases || []).map((p) => (
            <div key={p._id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 hover:bg-[#faf9f6] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1c1d1f] truncate">{p.course?.title || 'Deleted course'}</p>
                <p className="text-[11px] text-[#9e9e9e] mt-0.5">
                  {p.months} month{p.months > 1 ? 's' : ''} · {p.currency} {Number(p.amountPaid || 0).toFixed(2)}
                  {p.paymentProvider === 'manual' ? ' · Manual' : ' · Stripe'}
                  {p.endDate ? ` · Ends ${new Date(p.endDate).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {statusBadge(p.status, p.endDate)}
                {['pending', 'failed', 'cancelled', 'expired'].includes(p.status) && (
                  <button
                    onClick={() => activatePurchase(p._id)}
                    disabled={activatingId === p._id}
                    className="btn-success text-[11px] py-1.5 px-2.5 disabled:opacity-50"
                  >
                    {activatingId === p._id ? 'Activating…' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity logs */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#e8e6e0]">
          <p className="text-[14px] font-semibold text-[#1c1d1f]">Recent Activity</p>
          <p className="text-[12px] text-[#6a6f73] mt-0.5">Last 20 security events</p>
        </div>
        <div className="divide-y divide-[#f0ece4]">
          {(recentLogs || []).length === 0
            ? <p className="text-center text-[13px] text-[#9e9e9e] py-10">No activity logs found</p>
            : (recentLogs || []).map(log => (
                <div key={log._id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#faf9f6] transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-[#f0ece4] flex items-center justify-center flex-shrink-0">
                    {EVENT_ICONS[log.event] || <IconAlertCircle className="w-4 h-4 text-[#9e9e9e]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#1c1d1f] capitalize">{log.event?.replace(/_/g, ' ')}</p>
                    {log.ip && <p className="text-[11px] text-[#9e9e9e] mt-0.5 font-mono">IP: {log.ip}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`badge ${log.severity === 'critical' ? 'badge-red' : log.severity === 'warning' ? 'badge-yellow' : 'badge-gray'} text-[10px]`}>
                      {log.severity}
                    </span>
                    <p className="text-[10px] text-[#6a6f73] mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Grant course modal */}
      {grantOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setGrantOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[#e8e6e0]">
              <h3 className="text-[16px] font-bold text-[#1c1d1f]">Activate course access</h3>
              <p className="text-[12px] text-[#6a6f73] mt-1">
                For {user.name} — use when Stripe payment succeeded but webhook did not activate access.
              </p>
            </div>
            <form onSubmit={grantCourse} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider">Course</label>
                <select
                  required
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value, amountPaid: '' })}
                  className="mt-1.5 w-full rounded-xl border border-[#e0ddd6] bg-[#faf9f6] px-3 py-2.5 text-[13px]"
                >
                  <option value="">Select course…</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider">Duration (months)</label>
                <select
                  required
                  value={form.months}
                  onChange={(e) => {
                    const months = Number(e.target.value);
                    const tier = tiers.find((t) => Number(t.months) === months);
                    setForm({
                      ...form,
                      months,
                      amountPaid: tier ? String(tier.price) : form.amountPaid,
                      currency: tier?.currency || form.currency,
                    });
                  }}
                  className="mt-1.5 w-full rounded-xl border border-[#e0ddd6] bg-[#faf9f6] px-3 py-2.5 text-[13px]"
                >
                  {(tiers.length ? tiers.map((t) => t.months) : [1, 3, 6, 12]).map((m) => (
                    <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amountPaid}
                    onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#e0ddd6] bg-[#faf9f6] px-3 py-2.5 text-[13px]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider">Currency</label>
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    className="mt-1.5 w-full rounded-xl border border-[#e0ddd6] bg-[#faf9f6] px-3 py-2.5 text-[13px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider">Stripe Payment Intent (optional)</label>
                <input
                  value={form.stripePaymentIntentId}
                  onChange={(e) => setForm({ ...form, stripePaymentIntentId: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#e0ddd6] bg-[#faf9f6] px-3 py-2.5 text-[13px] font-mono"
                  placeholder="pi_..."
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider">Note (optional)</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-[#e0ddd6] bg-[#faf9f6] px-3 py-2.5 text-[13px]"
                  placeholder="e.g. Paid via Stripe, webhook missed"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setGrantOpen(false)} className="btn-secondary flex-1 py-2.5 text-[13px]">Cancel</button>
                <button type="submit" disabled={granting} className="btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-50">
                  {granting ? 'Activating…' : 'Activate access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
