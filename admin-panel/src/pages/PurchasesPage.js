import React, { useEffect, useState } from 'react';
import { purchasesAPI } from '../api';
import toast from 'react-hot-toast';
import {
  IconCheckCircle, IconAlertCircle, IconCourses,
} from '../components/Icons';

const statusColors = {
  active: 'badge-green',
  expired: 'badge-gray',
  pending: 'badge-yellow',
  cancelled: 'badge-gray',
  failed: 'badge-red',
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activatingId, setActivatingId] = useState(null);
  const limit = 20;

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filter !== 'all') params.status = filter;
      const { data } = await purchasesAPI.getAll(params);
      setPurchases(data.data);
      setTotal(data.pagination?.total || 0);
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPurchases(); }, [filter, page]);

  const activatePurchase = async (p) => {
    if (!window.confirm(`Activate access for ${p.user?.name || 'this user'} — ${p.course?.title || 'course'}?`)) return;
    setActivatingId(p._id);
    try {
      await purchasesAPI.activate(p._id, { note: 'Activated from Purchases page (webhook recovery)' });
      toast.success('Purchase activated');
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate');
    } finally {
      setActivatingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
  const isExpired = (p) => p.status === 'active' && new Date(p.endDate) < new Date();

  return (
    <div className="page-wrap animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Course Purchases</h1>
          <p className="page-sub">{total} total purchases</p>
        </div>
      </div>

      <div className="flex gap-1 bg-[#f5f4f0] border border-[#e0ddd6] p-1 rounded-lg w-fit">
        {['all', 'active', 'expired', 'pending', 'failed'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-white text-[#1c1d1f] shadow-soft border border-[#e0ddd6]'
                : 'text-[#6a6f73] hover:text-[#1c1d1f]'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : purchases.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <IconCourses className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-[17px] font-bold text-[#1c1d1f]">No purchases found</p>
          <p className="text-[13px] text-[#6a6f73] mt-1.5">Students will appear here when they purchase courses</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0ece4] bg-[#faf9f6]">
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">Course</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">Duration</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">Amount</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">Start</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">End</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-[11px] font-semibold text-[#6a6f73] uppercase tracking-wider px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const expired = isExpired(p);
                  const canActivate = ['pending', 'failed', 'cancelled', 'expired'].includes(p.status) || expired;
                  return (
                    <tr key={p._id} className="border-b border-[#f5f4f0] hover:bg-[#faf9f6] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="text-[13px] font-medium text-[#1c1d1f]">{p.user?.name || 'Unknown'}</div>
                        <div className="text-[11px] text-[#9e9e9e]">{p.user?.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-[13px] text-[#1c1d1f]">{p.course?.title || 'Deleted Course'}</div>
                        {p.course?.category && <div className="text-[11px] text-[#9e9e9e]">{p.course.category}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-[#1c1d1f]">
                        {p.months === 1 ? '1 month' : p.months === 12 ? '12 months (1 year)' : `${p.months} months`}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-[#1c1d1f]">
                        {p.currency} {p.amountPaid?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-[#6a6f73]">{formatDate(p.startDate)}</td>
                      <td className="px-4 py-3.5 text-[13px] text-[#6a6f73]">{formatDate(p.endDate)}</td>
                      <td className="px-4 py-3.5">
                        {expired ? (
                          <span className="badge-gray"><IconAlertCircle className="w-3 h-3" />Expired</span>
                        ) : (
                          <span className={statusColors[p.status] || 'badge-gray'}>
                            {p.status === 'active' ? <><IconCheckCircle className="w-3 h-3" />Active</> : p.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {canActivate ? (
                          <button
                            onClick={() => activatePurchase(p)}
                            disabled={activatingId === p._id}
                            className="btn-success text-[11px] py-1.5 px-2.5 disabled:opacity-50"
                          >
                            {activatingId === p._id ? '…' : 'Activate'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#b0afab]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="btn-secondary text-[12px] px-4 py-2 disabled:opacity-40">
            Previous
          </button>
          <span className="text-[13px] text-[#6a6f73] font-medium">
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="btn-secondary text-[12px] px-4 py-2 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
