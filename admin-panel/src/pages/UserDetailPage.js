import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usersAPI, securityAPI } from '../api';
import toast from 'react-hot-toast';

const EVENT_ICONS = { login_success:'✅', login_failed:'❌', logout:'👋', screen_record_attempt:'🎥', screenshot_attempt:'📸', suspicious_activity:'🚨', session_terminated:'🔒', piracy_attempt:'🏴‍☠️', multi_device_login:'📱', playback_started:'▶️', subscription_expired:'💳', account_suspended:'🚫' };

export default function UserDetailPage() {
  const { id } = useParams();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.getById(id);
      setUserData(data.data);
    } catch { toast.error('Failed to load user'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUser(); }, [id]);

  const handleSuspend = async () => {
    const reason = window.prompt('Reason for suspension?');
    if (!reason) return;
    try { await usersAPI.suspend(id, reason); toast.success('User suspended'); fetchUser(); }
    catch { toast.error('Failed'); }
  };

  const handleUnsuspend = async () => {
    try { await usersAPI.unsuspend(id); toast.success('User unsuspended'); fetchUser(); }
    catch { toast.error('Failed'); }
  };

  const handleForceLogout = async () => {
    try { await usersAPI.forceLogout(id); toast.success('All sessions revoked'); }
    catch { toast.error('Failed'); }
  };

  const handleResetDevice = async () => {
    if (!window.confirm('Reset device binding?')) return;
    try { await usersAPI.resetDevice(id); toast.success('Device binding reset'); fetchUser(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="skeleton h-8 w-48"/>
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_,i)=><div key={i} className="card h-32 skeleton"/>)}</div>
    </div>
  );

  const { user, recentLogs } = userData || {};
  if (!user) return null;

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/users" className="hover:text-white transition-colors">Students</Link>
        <span>/</span>
        <span className="text-gray-200">{user.name}</span>
      </div>

      {/* Profile Card */}
      <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-violet-500/20 flex-shrink-0">
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
            {user.isSuspended ? <span className="badge-red">Suspended</span>
              : user.isFlagged ? <span className="badge-yellow">Flagged</span>
              : <span className="badge-green">Active</span>}
            {!user.isVerified && <span className="badge-gray">Unverified</span>}
          </div>
          <p className="text-gray-400 text-sm">{user.email}</p>
          {user.phone && <p className="text-gray-500 text-sm">{user.phone}</p>}
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            <span>📅 Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            {user.lastLogin && <span>🔐 Last login {new Date(user.lastLogin).toLocaleDateString()}</span>}
            {user.lastLoginIp && <span>🌐 {user.lastLoginIp}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {user.isSuspended
            ? <button onClick={handleUnsuspend} className="btn-success text-xs py-2 px-3">✅ Unsuspend</button>
            : <button onClick={handleSuspend} className="btn-danger text-xs py-2 px-3">🚫 Suspend</button>
          }
          <button onClick={handleForceLogout} className="btn-secondary text-xs py-2 px-3">🔒 Force Logout</button>
          {user.deviceId && <button onClick={handleResetDevice} className="btn-secondary text-xs py-2 px-3">📱 Reset Device</button>}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Subscription */}
        <div className="card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Subscription</p>
          {user.activeSubscription ? (
            <div className="space-y-2">
              <span className="badge-green">Active</span>
              <p className="text-lg font-bold text-white capitalize">{user.activeSubscription.plan?.name || user.activeSubscription.plan?.type || 'Plan'}</p>
              <p className="text-xs text-gray-500">Expires: {user.activeSubscription.endDate ? new Date(user.activeSubscription.endDate).toLocaleDateString() : '—'}</p>
            </div>
          ) : <p className="text-gray-500 text-sm">No active subscription</p>}
        </div>

        {/* Device */}
        <div className="card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Device Binding</p>
          {user.deviceId ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">{user.deviceName || 'Unknown Device'}</p>
              <p className="text-xs text-gray-500 font-mono break-all">{user.deviceId}</p>
              {user.deviceBoundAt && <p className="text-xs text-gray-600">Bound {new Date(user.deviceBoundAt).toLocaleDateString()}</p>}
            </div>
          ) : <p className="text-gray-500 text-sm">No device bound</p>}
        </div>

        {/* Risk */}
        <div className="card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Risk Score</p>
          <div className="space-y-3">
            <p className={`text-4xl font-black ${user.riskScore>=60?'text-red-400':user.riskScore>=30?'text-amber-400':'text-emerald-400'}`}>{user.riskScore || 0}</p>
            <div className="h-2 bg-white/[0.07] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${user.riskScore>=60?'bg-red-500':user.riskScore>=30?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${user.riskScore}%`}}/>
            </div>
            {user.flagReason && <p className="text-xs text-amber-400">⚠️ {user.flagReason}</p>}
            {user.suspensionReason && <p className="text-xs text-red-400">🚫 {user.suspensionReason}</p>}
          </div>
        </div>
      </div>

      {/* Security Logs */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <p className="font-semibold text-white">Recent Activity</p>
          <p className="text-xs text-gray-500 mt-0.5">Last 20 security events</p>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {(recentLogs || []).length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">No activity logs</p>
          ) : (recentLogs || []).map(log => (
            <div key={log._id} className="flex items-center gap-3 p-4 hover:bg-white/[0.02] transition-colors">
              <span className="text-base flex-shrink-0">{EVENT_ICONS[log.event] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 capitalize">{log.event?.replace(/_/g,' ')}</p>
                {log.details && <p className="text-xs text-gray-600 truncate">{JSON.stringify(log.details)}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`badge ${log.severity==='critical'?'badge-red':log.severity==='warning'?'badge-yellow':'badge-gray'}`}>{log.severity}</span>
                <p className="text-[10px] text-gray-600 mt-1">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
