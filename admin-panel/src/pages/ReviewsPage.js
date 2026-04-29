import React, { useState, useEffect, useCallback } from 'react';
import { reviewsAPI } from '../api';
import toast from 'react-hot-toast';
import { IconStar, IconTrash, IconCheckCircle, IconSearch, IconFilter, IconX } from '../components/Icons';

const statusColors = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (courseFilter.trim()) params.courseId = courseFilter.trim();
      if (statusFilter === 'pending') params.isApproved = false;
      if (statusFilter === 'approved') params.isApproved = true;
      const { data } = await reviewsAPI.getAllAdmin(params);
      setReviews(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [page, limit, courseFilter, statusFilter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleApprove = async (reviewId) => {
    try {
      await reviewsAPI.approve(reviewId);
      toast.success('Review approved');
      fetchReviews();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await reviewsAPI.delete(reviewId);
      toast.success('Review deleted');
      fetchReviews();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <IconStar
            key={star}
            className={`w-3.5 h-3.5 ${star <= rating ? 'text-amber-400 fill-current' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1c1d1f]">Course Reviews</h1>
          <p className="text-[13px] text-[#6a6f73] mt-1">
            {total} review{total !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 w-64 focus-within:border-brand-400 transition-all">
          <IconSearch className="w-3.5 h-3.5 text-[#9e9e9e] flex-shrink-0" />
          <input
            className="bg-transparent text-[13px] text-[#1c1d1f] placeholder-[#9e9e9e] outline-none flex-1 min-w-0"
            placeholder="Filter by Course ID..."
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
          />
          {courseFilter && (
            <button onClick={() => setCourseFilter('')} className="text-[#9e9e9e] hover:text-[#1c1d1f]">
              <IconX className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#e0ddd6] rounded-lg px-3 py-2">
          <IconFilter className="w-3.5 h-3.5 text-[#9e9e9e]" />
          <select
            className="bg-transparent text-[13px] text-[#1c1d1f] outline-none"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20">
          <IconStar className="w-12 h-12 text-[#d1d0cc] mx-auto mb-3" />
          <p className="text-[14px] font-medium text-[#6a6f73]">No reviews found</p>
          <p className="text-[12px] text-[#9e9e9e] mt-1">Reviews submitted by students will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review._id}
              className="bg-white border border-[#e8e6e0] rounded-xl p-5 hover:shadow-soft transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: User & Course Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-[13px] font-bold text-brand-600 flex-shrink-0">
                      {review.user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1c1d1f]">{review.user?.name || 'Unknown User'}</p>
                      <p className="text-[11px] text-[#9e9e9e]">{review.user?.email || ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                      {review.course?.title || 'Unknown Course'}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusColors[review.isApproved ? 'approved' : 'pending']}`}>
                      {review.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(review.rating)}
                    <span className="text-[12px] font-semibold text-[#1c1d1f]">{review.rating}/5</span>
                  </div>

                  {review.comment && (
                    <p className="text-[13px] text-[#3d3d3d] leading-relaxed bg-[#faf9f6] rounded-lg p-3 mt-1">
                      "{review.comment}"
                    </p>
                  )}

                  <p className="text-[11px] text-[#9e9e9e] mt-2">
                    {new Date(review.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!review.isApproved && (
                    <button
                      onClick={() => handleApprove(review._id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      <IconCheckCircle className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(review._id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-red-500 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[#e8e6e0]">
          <p className="text-[12px] text-[#6a6f73]">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-[12px] font-semibold text-[#6a6f73] border border-[#e0ddd6] rounded-lg disabled:opacity-40 hover:bg-[#f5f4f0] transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={'w-8 h-8 text-[12px] font-semibold rounded-lg transition-colors ' + (p === page ? 'bg-brand-500 text-white' : 'text-[#6a6f73] border border-[#e0ddd6] hover:bg-[#f5f4f0]')}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-[12px] font-semibold text-[#6a6f73] border border-[#e0ddd6] rounded-lg disabled:opacity-40 hover:bg-[#f5f4f0] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
