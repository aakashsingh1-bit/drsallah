import React, { useState } from 'react';
import { lessonsAPI } from '../api';
import toast from 'react-hot-toast';

export default function LessonModal({ moduleId, lesson, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: lesson?.title || '',
    description: lesson?.description || '',
    isPublished: lesson?.isPublished || false,
    isFree: lesson?.isFree || false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (lesson) {
        await lessonsAPI.update(lesson._id, payload);
        toast.success('Lesson updated');
      } else {
        await lessonsAPI.create(moduleId, payload);
        toast.success('Lesson created — upload video next!');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save lesson');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#e8e6e0] rounded-2xl w-full max-w-md shadow-card-lg animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-[#e8e6e0]">
          <h2 className="text-lg font-bold text-[#1c1d1f]">{lesson ? 'Edit Lesson' : 'New Lesson'}</h2>
          <button onClick={onClose} className="text-[#9e9e9e] hover:text-[#1c1d1f] text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="field-label">Lesson Title *</label>
            <input className="field-input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Introduction - What is Algebra?" />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea className="field-textarea min-h-16" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description of this lesson" />
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setForm({...form, isPublished: !form.isPublished})}>
              <div className={`w-10 h-5 rounded-full transition-colors ${form.isPublished ? 'bg-brand-500' : 'bg-[#d1d0cc]'} relative flex-shrink-0`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-[13px] text-[#6a6f73]">Publish lesson</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setForm({...form, isFree: !form.isFree})}>
              <div className={`w-10 h-5 rounded-full transition-colors ${form.isFree ? 'bg-emerald-500' : 'bg-[#d1d0cc]'} relative flex-shrink-0`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isFree ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-[13px] text-[#6a6f73]">Free preview lesson</span>
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Saving...' : lesson ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
