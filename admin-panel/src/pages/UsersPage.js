import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | suspended | flagged
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, search };
      if (filter === 'suspended') params.isSuspended = true;
      if (filter === 'flagged') params.isFlagged = true;
      const { data } = await usersAPI.getAll(params);
      setUsers(data.data);
      setTotal(data.pagination.total);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [page, search, filter]);

  const handleSuspend = async (user) => {
    const reason = window.prompt(`Reason for suspending ${user.name}?`);
    if (reason === null) return;
    try {
      await usersAPI.suspend(user._id, reason || 'Suspended by admin');
      toast.success('User suspended');
      fetchUsers();
    } catch { toast.error('Failed to suspend'); }
  };

  const handleUnsuspend = async (user) => {
    try {
      await usersAPI.unsuspend(user._id);
      toast.success('User unsuspended');
      fetchUsers();
    } catch { toast.error('Failed'); }
  };

  const handleForceLogout = async (userId) => {
    try {
      await usersAPI.forceLogout(userId);
      toast.success('User force logged out');
    } catch { toast.error('Failed'); }
  };

  const handleResetDevice = async (userId) => {
    if (!window.confirm('Reset device binding for this user?')) return;
    try {
      await usersAPI.resetDevice(userId);
      toast.success('Device binding reset');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-gray-400 text-sm">{total} total students</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input className="input flex-1" placeholder="🔍 Search by name, email or phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <div className="flex gap-2">
          {['all', 'flagged', 'suspended'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left text-xs text-gray-400 font-medium p-4">Student</th>
                <th className="text-left text-xs text-gray-400 font-medium p-4">Status</th>
                <th className="text-left text-xs text-gray-400 font-medium p-4">Risk</th>
                <th className="text-left text-xs text-gray-400 font-medium p-4">Device</th>
                <th className="text-left text-xs text-gray-400 font-medium p-4">Joined</th>
                <th className="text-right text-xs text-gray-400 font-medium p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-dark-600">
                    {[...Array(6)].map((_, j) => <td key={j} className="p-4"><div className="h-4 bg-dark-700 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : users.map(user => (
                <tr key={user._id} className="table-row">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {user.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <Link to={`/users/${user._id}`} className="text-sm font-medium text-white hover:text-primary-400 transition-colors">{user.name}</Link>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {user.isSuspended ? <span className="badge-red">Suspended</span>
                      : user.isFlagged ? <span className="badge-yellow">Flagged</span>
                      : <span className="badge-green">Active</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${user.riskScore >= 60 ? 'bg-red-500' : user.riskScore >= 30 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${user.riskScore}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{user.riskScore || 0}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-gray-400 truncate max-w-24 block">{user.deviceId ? user.deviceName || 'Bound' : 'None'}</span>
                  </td>
                  <td className="p-4 text-xs text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 justify-end">
                      <Link to={`/users/${user._id}`} className="text-gray-400 hover:text-white p-1 rounded transition-colors text-xs">👁️</Link>
                      {user.isSuspended
                        ? <button onClick={() => handleUnsuspend(user)} className="text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-2 py-1 rounded-lg">Unsuspend</button>
                        : <button onClick={() => handleSuspend(user)} className="text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 px-2 py-1 rounded-lg">Suspend</button>
                      }
                      <button onClick={() => handleForceLogout(user._id)} className="text-xs text-gray-400 hover:text-yellow-400 p-1 rounded" title="Force Logout">🔓</button>
                      {user.deviceId && (
                        <button onClick={() => handleResetDevice(user._id)} className="text-xs text-gray-400 hover:text-blue-400 p-1 rounded" title="Reset Device">📱</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between p-4 border-t border-dark-600">
            <p className="text-xs text-gray-400">Showing {Math.min((page-1)*LIMIT+1, total)}-{Math.min(page*LIMIT, total)} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => p+1)} disabled={page * LIMIT >= total} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
