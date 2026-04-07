import React, { useEffect, useState } from 'react';
import { securityAPI, usersAPI } from '../api';
import toast from 'react-hot-toast';

const SEV_COLORS = { info: 'badge-blue', warning: 'badge-yellow', critical: 'badge-red' };
const EVENT_ICONS = {
  login_success: '✅', login_failed: '❌', logout: '👋', screen_record_attempt: '🎥',
  screenshot_attempt: '📸', suspicious_activity: '🚨', session_terminated: '🔒',
  piracy_attempt: '🏴‍☠️', multi_device_login: '📱', device_changed: '🔄',
  playback_started: '▶️', subscription_expired: '💳', account_suspended: '🚫',
};

export default function SecurityPage() {
  const [logs, setLogs] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('logs');
  const [severity, setSeverity] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 30;

  useEffect(() => {
    fetchLogs();
    if (tab === 'flagged') fetchFlagged();
  }, [tab, severity, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (severity !== 'all') params.severity = severity;
      const { data } = await securityAPI.getLogs(params);
      setLogs(data.data);
      setTotal(data.pagination?.total || 0);
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  };

  const fetchFlagged = async () => {
    try {
      const { data } = await securityAPI.getFlagged();
      setFlagged(data.data);
    } catch {}
  };

  const handleResolve = async (id) => {
    try {
      await securityAPI.resolveLog(id);
      toast.success('Log resolved');
      fetchLogs();
    } catch { toast.error('Failed'); }
  };

  const handleSuspend = async (userId) => {
    const reason = window.prompt('Reason for suspension?');
    if (!reason) return;
    try {
      await usersAPI.suspend(userId, reason);
      toast.success('User suspended');
      fetchFlagged();
    } catch { toast.error('Failed'); }
  };

  const criticalCount = logs.filter(l => l.severity === 'critical' && !l.resolved).length;

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Security Monitor
            {criticalCount > 0 && <span className="badge-red animate-pulse">{criticalCount} Critical</span>}
          </h1>
          <p className="page-sub">Real-time threat detection and activity logs</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Critical Alerts', value: logs.filter(l=>l.severity==='critical').length, icon: '🚨', color: 'from-red-600/20 to-red-600/5', badge: 'badge-red' },
          { label: 'Warnings', value: logs.filter(l=>l.severity==='warning').length, icon: '⚠️', color: 'from-amber-600/20 to-amber-600/5', badge: 'badge-yellow' },
          { label: 'Flagged Users', value: flagged.length, icon: '🚩', color: 'from-orange-600/20 to-orange-600/5', badge: 'badge-yellow' },
          { label: 'Piracy Attempts', value: logs.filter(l=>l.event==='piracy_attempt').length, icon: '🏴‍☠️', color: 'from-purple-600/20 to-purple-600/5', badge: 'badge-purple' },
        ].map((s, i) => (
          <div key={i} className={`card p-4 bg-gradient-to-br ${s.color} border-white/[0.07]`}>
            <div className="flex items-start justify-between">
              <span className="text-2xl">{s.icon}</span>
            </div>
            <p className="text-3xl font-black text-white mt-2">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl w-fit border border-white/[0.06]">
        {['logs', 'flagged'].map(t => (
          <button key={t} onClick={() => { setTab(t); if(t==='flagged') fetchFlagged(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-gray-400 hover:text-white'}`}>
            {t === 'flagged' ? `🚩 Flagged Users` : '📋 Activity Logs'}
          </button>
        ))}
      </div>

      {tab === 'logs' ? (
        <>
          {/* Severity filter */}
          <div className="flex flex-wrap gap-2">
            {['all','info','warning','critical'].map(s => (
              <button key={s} onClick={() => { setSeverity(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${severity === s ? 'bg-violet-600/80 text-white' : 'bg-white/[0.05] text-gray-400 hover:text-white border border-white/[0.08]'}`}>
                {s}
              </button>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/[0.06]">
                  <tr>
                    {['Event', 'User', 'Severity', 'IP', 'Time', 'Action'].map(h => <th key={h} className="th">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(8)].map((_,i)=>(
                    <tr key={i} className="tr">{[...Array(6)].map((_,j)=><td key={j} className="td"><div className="skeleton h-4"/></td>)}</tr>
                  )) : logs.map(log => (
                    <tr key={log._id} className={`tr ${log.severity==='critical'&&!log.resolved ? 'bg-red-500/[0.03]' : ''}`}>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{EVENT_ICONS[log.event] || '📌'}</span>
                          <span className="text-xs font-medium capitalize text-gray-200">{log.event?.replace(/_/g,' ')}</span>
                        </div>
                      </td>
                      <td className="td">
                        <p className="text-xs text-white">{log.user?.name || '—'}</p>
                        <p className="text-[10px] text-gray-500">{log.user?.email}</p>
                      </td>
                      <td className="td"><span className={SEV_COLORS[log.severity]}>{log.severity}</span></td>
                      <td className="td text-xs text-gray-400 font-mono">{log.ip || '—'}</td>
                      <td className="td text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="td">
                        {!log.resolved && log.severity !== 'info' && (
                          <button onClick={() => handleResolve(log._id)}
                            className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-1 rounded-lg transition-colors border border-emerald-500/20">
                            Resolve
                          </button>
                        )}
                        {log.resolved && <span className="badge-green text-[10px]">Resolved</span>}
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
        /* Flagged users */
        <div className="space-y-3">
          {flagged.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-5xl mb-3">✅</p>
              <p className="text-white font-semibold">No flagged users</p>
              <p className="text-gray-400 text-sm mt-1">All users are within normal behavior</p>
            </div>
          ) : flagged.map(user => (
            <div key={user._id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">{user.name}</p>
                  {user.isSuspended && <span className="badge-red text-[10px]">Suspended</span>}
                </div>
                <p className="text-xs text-gray-500">{user.email}</p>
                {user.flagReason && <p className="text-xs text-amber-400 mt-0.5">⚠️ {user.flagReason}</p>}
              </div>
              <div className="text-center px-4">
                <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-dark-600 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${user.riskScore>=60?'bg-red-500':user.riskScore>=30?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${user.riskScore}%`}}/>
                  </div>
                  <span className="text-sm font-bold text-white">{user.riskScore}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {!user.isSuspended && (
                  <button onClick={() => handleSuspend(user._id)} className="btn-danger text-xs py-1.5 px-3">Suspend</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
