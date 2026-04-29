import React, { useState } from 'react';
import { coursesAPI } from '../api';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

export default function CourseModal({ course, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: course?.title || '',
    description: course?.description || '',
    category: course?.category || '',
    instructor: course?.instructor || 'Dr. Sallah',
    level: course?.level || 'all',
    language: course?.language || 'Arabic',
    isPublished: course?.isPublished || false,
  });
  const [thumb, setThumb] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(course?.thumbnail || null);
  const [loading, setLoading] = useState(false);

  // Price tiers state
  const [priceTiers, setPriceTiers] = useState(() => {
    if (course?.priceTiers?.length > 0) return course.priceTiers;
    const defaults = [
      { months: 1, price: 29, currency: 'AED', isActive: true },
      { months: 3, price: 79, currency: 'AED', isActive: true },
      { months: 6, price: 149, currency: 'AED', isActive: true },
      { months: 12, price: 199, currency: 'AED', isActive: true },
    ];
    const allMonths = [];
    for (let m = 1; m <= 12; m++) {
      const existing = defaults.find(t => t.months === m);
      allMonths.push(existing || { months: m, price: 0, currency: 'AED', isActive: false });
    }
    return allMonths;
  });

  const updatePriceTier = (months, field, value) => {
    setPriceTiers(prev => prev.map(tier =>
      tier.months === months ? { ...tier, [field]: value } : tier
    ));
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    onDrop: (files) => {
      setThumb(files[0]);
      setThumbPreview(URL.createObjectURL(files[0]));
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (thumb) fd.append('thumbnail', thumb);
      fd.append('priceTiers', JSON.stringify(priceTiers));

      if (course) {
        await coursesAPI.update(course._id, fd);
        toast.success('Course updated');
      } else {
        await coursesAPI.create(fd);
        toast.success('Course created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (months) => {
    if (months === 1) return '1 month';
    if (months === 12) return '12 months (1 year)';
    return `${months} months`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#e8e6e0] rounded-2xl w-full max-w-2xl shadow-card-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-[#e8e6e0] sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-[#1c1d1f]">{course ? 'Edit Course' : 'New Course'}</h2>
          <button onClick={onClose} className="text-[#9e9e9e] hover:text-[#1c1d1f] text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Thumbnail */}
          <div>
            <label className="field-label">Course Thumbnail</label>
            <div {...getRootProps()} className="border-2 border-dashed border-[#d1d0cc] hover:border-brand-400 rounded-xl p-4 cursor-pointer transition-colors text-center bg-[#faf9f6]">
              <input {...getInputProps()} />
              {thumbPreview ? (
                <img src={thumbPreview} alt="thumb" className="h-32 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="py-4">
                  <p className="text-3xl">🖼️</p>
                  <p className="text-[12px] text-[#9e9e9e] mt-1">Drop image or click to browse</p>
                  <p className="text-[11px] text-[#b0afab]">JPG, PNG, WebP</p>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="field-label">Title *</label>
            <input className="field-input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Course title" />
          </div>

          {/* Description */}
          <div>
            <label className="field-label">Description</label>
            <textarea className="field-textarea min-h-20" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the course" />
          </div>

          {/* Row: Category + Instructor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Category</label>
              <input className="field-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Math, Science" />
            </div>
            <div>
              <label className="field-label">Instructor</label>
              <input className="field-input" value={form.instructor} onChange={e => setForm({...form, instructor: e.target.value})} />
            </div>
          </div>

          {/* Row: Level + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Level</label>
              <select className="field-select" value={form.level} onChange={e => setForm({...form, level: e.target.value})}>
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="field-label">Language</label>
              <input className="field-input" value={form.language} onChange={e => setForm({...form, language: e.target.value})} placeholder="Arabic, English..." />
            </div>
          </div>

          {/* Price Tiers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="field-label mb-0">Course Pricing (Per-Duration Access)</label>
              <span className="text-[11px] text-[#6a6f73]">Set prices for different access durations</span>
            </div>

            <div className="bg-[#faf9f6] rounded-xl p-4 border border-[#e8e6e0] space-y-3">
              {priceTiers
                .filter(tier => tier.months <= 12)
                .map((tier) => (
                <div
                  key={tier.months}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${tier.isActive ? 'bg-white border border-[#e0ddd6]' : 'bg-transparent border border-dashed border-[#d1d0cc] opacity-60'}`}
                >
                  {/* Duration Badge */}
                  <div className="w-20 flex-shrink-0">
                    <div className={`text-xs font-bold px-2 py-1 rounded text-center ${tier.isActive ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                      {formatDuration(tier.months)}
                    </div>
                  </div>

                  {/* Price Input */}
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9e9e] text-sm font-medium">AED</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="field-input pl-12"
                      value={tier.price}
                      onChange={e => updatePriceTier(tier.months, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      disabled={!tier.isActive}
                    />
                  </div>

                  {/* Currency */}
                  <div className="w-20">
                    <select
                      className="field-select"
                      value={tier.currency}
                      onChange={e => updatePriceTier(tier.months, 'currency', e.target.value.toUpperCase())}
                      disabled={!tier.isActive}
                    >
                      <option value="AED">AED</option>
                    </select>
                  </div>

                  {/* Active Toggle */}
                  <button
                    type="button"
                    onClick={() => updatePriceTier(tier.months, 'isActive', !tier.isActive)}
                    className={`p-2 rounded-lg transition-colors ${tier.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    title={tier.isActive ? 'Active' : 'Inactive'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#9e9e9e]">
              Users can purchase access to this course for the selected duration. After the access period expires, they need to repurchase.
            </p>
          </div>

          {/* Publish */}
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setForm({...form, isPublished: !form.isPublished})}>
            <div className={`w-11 h-6 rounded-full transition-colors ${form.isPublished ? 'bg-brand-500' : 'bg-[#d1d0cc]'} relative`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-[13px] text-[#6a6f73]">
              Publish course immediately
            </span>
          </label>

          <div className="flex gap-3 pt-2 border-t border-[#e8e6e0]">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Saving...' : course ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
