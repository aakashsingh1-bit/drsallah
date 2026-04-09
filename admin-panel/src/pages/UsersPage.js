import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api';
import toast from 'react-hot-toast';
import { IconUsers, IconSecurity, IconDevice, IconAlertTriangle, IconPlus, IconChevronRight } from '../components/Icons';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (filter === 'suspended') params.isSuspended = true;
      if (filter === 'flagged') params.isFlagged = true;
      const { data } = await usersAPI.getAll(params);
      setUsers(data.data);
      setTotal(data.pagination?.total || 0);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); }, [search, filter]);
  useEffect(() => { fetchUsers(); }, [page, search, filter]);

  const suspend = async (user) => {
    const reason = window.prompt(`Suspend "${user.name}"? Enter reason:`);
    if (reason === null) return;
    try { await usersAPI.suspend(user._id, reason || 'Policy violation'); toast.success('User suspended'); fetchUsers(); }
    catch { toast.error('Failed'); }
  };

  const unsuspend = async (user) => {
    try { await usersAPI.unsuspend(user._id); toast.success('User unsuspended'); fetchUsers(); }
    catch { toast.error('Failed'); }
  };

  const forceLogout = async (id) => {
    try { await usersAPI.forceLogout(id); toast.success('Sessions revoked'); }
    catch { toast.error('Failed'); }
  };

  const resetDevice = async (user) => {
    if (!window.confirm(`Reset device binding for ${user.name}?`)) return;
    try { await usersAPI.resetDevice(user._id); toast.success('Device reset'); fetchUsers(); }
    catch { toast.error('Failed'); }
  };

  const RiskBar = ({ score }) => (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#f0ece4] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 60 ? 'bg-red-500' : score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[11px] text-[#9e9e9e] font-mono w-6">{score || 0}</span>
    </div>
  );

  return (
    <div className="page-wrap animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-sub">{total} registered students</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b0afab]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input className="field-input pl-10" placeholder="Search by name, email or phone..." value={search} onChange={e => { setSearch(e.target.value); }} />
        </div>
        <div className="flex gap-1.5 bg-[#f0ece4] p-1 rounded-lg border border-[#e0ddd6]">
          {[['all','All'], ['active','Active'], ['flagged','Flagged'], ['suspended','Suspended']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${filter === v ? 'bg-white text-[#1c1d1f] shadow-soft' : 'text-[#6a6f73] hover:text-[#1c1d1f]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#e8e6e0]">
              <tr>
                <th className="tbl-head">Student</th>
                <th className="tbl-head">Status</th>
                <th className="tbl-head">Risk Score</th>
                <th className="tbl-head">Device</th>
                <th className="tbl-head">Subscription</th>
                <th className="tbl-head">Joined</th>
                <th className="tbl-head text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="tbl-row">
                    {[...Array(7)].map((_, j) => <td key={j} className="tbl-cell"><div className="skeleton h-4 rounded" /></td>)}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="tbl-cell text-center py-12 text-[#9e9e9e]">No students found</td>
                </tr>
              ) : users.map(user => (
                <tr key={user._id} className="tbl-row">
                  <td className="tbl-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {user.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link to={`/users/${user._id}`} className="text-[13px] font-semibold text-[#1c1d1f] hover:text-brand-600 transition-colors block truncate max-w-[140px]">
                          {user.name}
                        </Link>
                        <p className="text-[11px] text-[#9e9e9e] truncate max-w-[160px]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tbl-cell">
                    {user.isSuspended ? <span className="badge-red"><IconSecurity className="w-3 h-3"/>Suspended</span>
                      : user.isFlagged ? <span className="badge-yellow"><IconAlertTriangle className="w-3 h-3"/>Flagged</span>
                      : <span className="badge-green">Active</span>}
                  </td>
                  <td className="tbl-cell"><RiskBar score={user.riskScore} /></td>
                  <td className="tbl-cell">
                    {user.deviceId
                      ? <span className="flex items-center gap-1.5 text-[11px] text-[#6a6f73]"><IconDevice className="w-3.5 h-3.5 text-blue-500" />{user.deviceName || 'Bound'}</span>
                      : <span className="text-[11px] text-[#9e9e9e]">None</span>
                    }
                  </td>
                  <td className="tbl-cell">
                    {user.activeSubscription
                      ? <span className="badge-purple text-[10px] capitalize">{user.activeSubscription.plan?.type || 'Active'}</span>
                      : <span className="text-[11px] text-[#9e9e9e]">None</span>
                    }
                  </td>
                  <td className="tbl-cell text-[12px] text-[#9e9e9e]">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="tbl-cell">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Link to={`/users/${user._id}`} title="View" className="btn-icon w-7 h-7 rounded-lg">
                        <IconChevronRight className="w-3.5 h-3.5" />
                      </Link>
                      {user.isSuspended
                        ? <button onClick={() => unsuspend(user)} className="text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors border border-emerald-200">Restore</button>
                        : <button onClick={() => suspend(user)} className="text-[11px] font-medium bg-red-50 text-red-700 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors border border-red-200">Suspend</button>
                      }
                      <button onClick={() => forceLogout(user._id)} title="Force Logout" className="btn-icon w-7 h-7 rounded-lg hover:text-amber-600">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                        </svg>
                      </button>
                      {user.deviceId && (
                        <button onClick={() => resetDevice(user)} title="Reset Device" className="btn-icon w-7 h-7 rounded-lg hover:text-blue-600">
                          <IconDevice className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3.5 border-t border-[#e8e6e0]">
            <p className="text-[12px] text-[#6a6f73]">Showing {Math.min((page-1)*LIMIT+1, total)}–{Math.min(page*LIMIT, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="btn-secondary px-3 py-1.5 text-[12px]">Previous</button>
              <button onClick={() => setPage(p => p+1)} disabled={page*LIMIT>=total} className="btn-secondary px-3 py-1.5 text-[12px]">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
