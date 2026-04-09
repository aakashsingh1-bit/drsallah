import React, { useEffect, useState } from 'react';
import { securityAPI, usersAPI } from '../api';
import toast from 'react-hot-toast';
import {
  IconSecurity, IconAlertTriangle, IconAlertCircle, IconCheckCircle,
  IconDevice, IconFlag, IconRefresh, IconUsers,
} from '../components/Icons';

const SEV = { info: 'badge-blue', warning: 'badge-yellow', critical: 'badge-red' };
const EVENT_ICON = {
  login_success: <IconCheckCircle className="w-3.5 h-3.5 text-emerald-500"/>,
  login_failed: <IconAlertCircle className="w-3.5 h-3.5 text-red-500"/>,
  screen_record_attempt: <IconAlertTriangle className="w-3.5 h-3.5 text-red-500"/>,
  screenshot_attempt: <IconAlertTriangle className="w-3.5 h-3.5 text-red-500"/>,
  suspicious_activity: <IconAlertCircle className="w-3.5 h-3.5 text-amber-500"/>,
  piracy_attempt: <IconAlertTriangle className="w-3.5 h-3.5 text-red-500"/>,
  multi_device_login: <IconDevice className="w-3.5 h-3.5 text-orange-500"/>,
  session_terminated: <IconSecurity className="w-3.5 h-3.5 text-amber-500"/>,
  account_suspended: <IconSecurity className="w-3.5 h-3.5 text-red-500"/>,
  playback_started: <IconCheckCircle className="w-3.5 h-3.5 text-blue-500"/>,
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

  useEffect(() => { fetchLogs(); if (tab === 'flagged') fetchFlagged(); }, [tab, severity, page]);
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (severity !== 'all') params.severity = severity;
      const { data } = await securityAPI.getLogs(params);
      setLogs(data.data); setTotal(data.pagination?.total || 0);
    } catch {} finally { setLoading(false); }
  };
  const fetchFlagged = async () => {
    try { const { data } = await securityAPI.getFlagged(); setFlagged(data.data); }
    catch {}
  };
  const resolve = async (id) => {
    try { await securityAPI.resolveLog(id); toast.success('Resolved'); fetchLogs(); }
    catch { toast.error('Failed'); }
  };
  const suspend = async (uid) => {
    const r = window.prompt('Suspension reason?');
    if (!r) return;
    try { await usersAPI.suspend(uid, r); toast.success('Suspended'); fetchFlagged(); }
    catch { toast.error('Failed'); }
  };

  const critCount = logs.filter(l => l.severity === 'critical' && !l.resolved).length;

  return (
    <div className="page-wrap animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            Security Monitor
            {critCount > 0 && <span className="badge-red animate-pulse">{critCount} Critical</span>}
          </h1>
          <p className="page-sub">Real-time threat detection and activity logs</p>
        </div>
        <button onClick={() => { fetchLogs(); fetchFlagged(); }} className="btn-secondary gap-2">
          <IconRefresh className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Critical Alerts', value: logs.filter(l=>l.severity==='critical').length, Icon: IconAlertTriangle, bg: 'bg-red-50', color: 'text-red-600', border: 'border-red-200' },
          { label: 'Warnings', value: logs.filter(l=>l.severity==='warning').length, Icon: IconAlertCircle, bg: 'bg-amber-50', color: 'text-amber-600', border: 'border-amber-200' },
          { label: 'Flagged Users', value: flagged.length, Icon: IconFlag, bg: 'bg-orange-50', color: 'text-orange-600', border: 'border-orange-200' },
          { label: 'Piracy Attempts', value: logs.filter(l=>l.event==='piracy_attempt').length, Icon: IconSecurity, bg: 'bg-violet-50', color: 'text-violet-600', border: 'border-violet-200' },
        ].map((s, i) => (
          <div key={i} className={`card p-4 border ${s.border}`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
              <s.Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-black text-[#1c1d1f]">{s.value}</p>
            <p className="text-[12px] text-[#6a6f73] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f0ece4] p-1 rounded-lg w-fit border border-[#e0ddd6]">
        {[['logs','Activity Logs'],['flagged','Flagged Users']].map(([v,l]) => (
          <button key={v} onClick={() => { setTab(v); if(v==='flagged') fetchFlagged(); }}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab===v ? 'bg-white text-[#1c1d1f] shadow-soft' : 'text-[#6a6f73] hover:text-[#1c1d1f]'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'logs' ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {['all','info','warning','critical'].map(s => (
              <button key={s} onClick={() => { setSeverity(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${severity===s ? 'bg-brand-600 text-white' : 'bg-white text-[#6a6f73] hover:text-[#1c1d1f] border border-[#e0ddd6]'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#e8e6e0]">
                  <tr>{['Event','User','Severity','IP','Time','Action'].map(h => <th key={h} className="tbl-head">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loading ? [...Array(8)].map((_,i) => <tr key={i}>{[...Array(6)].map((_,j) => <td key={j} className="tbl-cell"><div className="skeleton h-4 rounded" /></td>)}</tr>)
                  : logs.map(log => (
                    <tr key={log._id} className={`tbl-row ${log.severity==='critical' && !log.resolved ? 'bg-red-50' : ''}`}>
                      <td className="tbl-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#f0ece4] flex items-center justify-center flex-shrink-0">
                            {EVENT_ICON[log.event] || <IconAlertCircle className="w-3.5 h-3.5 text-[#9e9e9e]"/>}
                          </div>
                          <span className="text-[12px] font-medium text-[#1c1d1f] capitalize">{log.event?.replace(/_/g,' ')}</span>
                        </div>
                      </td>
                      <td className="tbl-cell">
                        <p className="text-[12px] text-[#1c1d1f]">{log.user?.name || '—'}</p>
                        <p className="text-[10px] text-[#9e9e9e]">{log.user?.email}</p>
                      </td>
                      <td className="tbl-cell"><span className={`${SEV[log.severity]} text-[10px]`}>{log.severity}</span></td>
                      <td className="tbl-cell text-[11px] text-[#9e9e9e] font-mono">{log.ip || '—'}</td>
                      <td className="tbl-cell text-[11px] text-[#9e9e9e]">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="tbl-cell">
                        {log.resolved
                          ? <span className="badge-green text-[10px]"><IconCheckCircle className="w-3 h-3"/>Resolved</span>
                          : log.severity !== 'info' && (
                              <button onClick={() => resolve(log._id)} className="text-[11px] font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors border border-emerald-200">
                                Resolve
                              </button>
                            )
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > LIMIT && (
              <div className="flex items-center justify-between px-4 py-3.5 border-t border-[#e8e6e0]">
                <p className="text-[12px] text-[#6a6f73]">Showing {Math.min((page-1)*LIMIT+1,total)}–{Math.min(page*LIMIT,total)} of {total}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1.5 text-[12px]">Previous</button>
                  <button onClick={() => setPage(p=>p+1)} disabled={page*LIMIT>=total} className="btn-secondary px-3 py-1.5 text-[12px]">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          {flagged.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <IconCheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-[#1c1d1f] font-semibold">No flagged users</p>
              <p className="text-[#9e9e9e] text-sm mt-1">All users have normal activity</p>
            </div>
          ) : flagged.map(user => (
            <div key={user._id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-semibold text-[#1c1d1f]">{user.name}</p>
                  {user.isSuspended && <span className="badge-red text-[10px]">Suspended</span>}
                </div>
                <p className="text-[12px] text-[#9e9e9e]">{user.email}</p>
                {user.flagReason && <p className="text-[11px] text-amber-600 mt-0.5">{user.flagReason}</p>}
              </div>
              <div className="text-center px-4">
                <p className="text-[10px] text-[#6a6f73] mb-1.5 uppercase tracking-widest">Risk</p>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#f0ece4] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${user.riskScore>=60?'bg-red-500':user.riskScore>=30?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${user.riskScore}%`}}/>
                  </div>
                  <span className="text-[13px] font-bold text-[#1c1d1f]">{user.riskScore}</span>
                </div>
              </div>
              {!user.isSuspended && (
                <button onClick={() => suspend(user._id)} className="btn-danger text-[12px] py-1.5 px-3">Suspend</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}