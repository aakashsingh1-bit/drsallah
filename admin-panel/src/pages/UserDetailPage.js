import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI } from '../api';
import toast from 'react-hot-toast';
import {
  IconChevronRight, IconSecurity, IconDevice, IconAlertTriangle,
  IconAlertCircle, IconCheckCircle, IconClock, IconGlobe, IconCalendar,
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
};

export default function UserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try { const { data: d } = await usersAPI.getById(id); setData(d.data); }
    catch { toast.error('Failed to load user'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [id]);

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

  if (loading) return (
    <div className="page-wrap space-y-4">
      {[...Array(4)].map((_,i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
    </div>
  );

  const { user, recentLogs } = data || {};
  if (!user) return null;

  return (
    <div className="page-wrap anim-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px]">
        <Link to="/users" className="text-gray-500 hover:text-white transition-colors">Students</Link>
        <IconChevronRight className="w-3.5 h-3.5 text-gray-700" />
        <span className="text-gray-300">{user.name}</span>
      </div>

      {/* Profile */}
      <div className="card p-6 flex flex-col sm:flex-row items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-black text-white shadow-xl shadow-indigo-500/20 flex-shrink-0">
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
            {user.isSuspended ? <span className="badge-red"><IconSecurity className="w-3 h-3" />Suspended</span>
              : user.isFlagged ? <span className="badge-yellow"><IconAlertTriangle className="w-3 h-3" />Flagged</span>
              : <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Active</span>}
            {!user.isVerified && <span className="badge-gray">Unverified</span>}
          </div>
          <p className="text-[13px] text-gray-500">{user.email}</p>
          {user.phone && <p className="text-[13px] text-gray-600 mt-0.5">{user.phone}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-gray-600">
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
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Subscription */}
        <div className="card p-5">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">Subscription</p>
          {user.activeSubscription ? (
            <div className="space-y-1.5">
              <span className="badge-green"><IconCheckCircle className="w-3 h-3" />Active</span>
              <p className="text-[16px] font-bold text-white mt-2 capitalize">{user.activeSubscription.plan?.name || user.activeSubscription.plan?.type || 'Plan'}</p>
              <p className="text-[12px] text-gray-500">Expires {user.activeSubscription.endDate ? new Date(user.activeSubscription.endDate).toLocaleDateString() : '—'}</p>
            </div>
          ) : <p className="text-[13px] text-gray-600">No active subscription</p>}
        </div>

        {/* Device */}
        <div className="card p-5">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">Device Binding</p>
          {user.deviceId ? (
            <div className="space-y-1.5">
              <span className="badge-blue"><IconDevice className="w-3 h-3" />Bound</span>
              <p className="text-[13px] font-semibold text-white mt-2">{user.deviceName || 'Unknown Device'}</p>
              <p className="text-[10px] text-gray-600 font-mono break-all">{user.deviceId.substring(0, 32)}...</p>
              {user.deviceBoundAt && <p className="text-[11px] text-gray-700">Bound {new Date(user.deviceBoundAt).toLocaleDateString()}</p>}
            </div>
          ) : <p className="text-[13px] text-gray-600">No device bound</p>}
        </div>

        {/* Risk */}
        <div className="card p-5">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4">Risk Score</p>
          <p className={`text-4xl font-black leading-none ${user.riskScore >= 60 ? 'text-rose-400' : user.riskScore >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {user.riskScore || 0}
          </p>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all ${user.riskScore >= 60 ? 'bg-rose-500' : user.riskScore >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${user.riskScore}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-600 mt-2">
            {user.riskScore >= 60 ? 'High risk — action recommended' : user.riskScore >= 30 ? 'Medium risk — monitor closely' : 'Low risk — normal behavior'}
          </p>
          {user.flagReason && <p className="text-[11px] text-amber-400 mt-1.5">{user.flagReason}</p>}
        </div>
      </div>

      {/* Activity logs */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/[0.05]">
          <p className="text-[14px] font-semibold text-white">Recent Activity</p>
          <p className="text-[12px] text-gray-600 mt-0.5">Last 20 security events</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {(recentLogs || []).length === 0
            ? <p className="text-center text-[13px] text-gray-600 py-10">No activity logs found</p>
            : (recentLogs || []).map(log => (
                <div key={log._id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.015] transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    {EVENT_ICONS[log.event] || <IconAlertCircle className="w-4 h-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-200 capitalize">{log.event?.replace(/_/g, ' ')}</p>
                    {log.ip && <p className="text-[11px] text-gray-600 mt-0.5 font-mono">IP: {log.ip}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`badge text-[10px] ${log.severity === 'critical' ? 'badge-red' : log.severity === 'warning' ? 'badge-yellow' : 'badge-gray'}`}>
                      {log.severity}
                    </span>
                    <p className="text-[10px] text-gray-700 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}
