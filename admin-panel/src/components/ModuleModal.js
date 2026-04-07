import React, { useState } from 'react';
import { modulesAPI } from '../api';
import toast from 'react-hot-toast';

export default function ModuleModal({ courseId, module, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: module?.title || '',
    description: module?.description || '',
    isPublished: module?.isPublished || false,
    scheduledAt: module?.scheduledAt ? module.scheduledAt.split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, scheduledAt: form.scheduledAt || null };
      if (module) {
        await modulesAPI.update(module._id, payload);
        toast.success('Module updated');
      } else {
        await modulesAPI.create(courseId, payload);
        toast.success('Module created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save module');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-dark-600">
          <h2 className="text-lg font-bold text-white">{module ? 'Edit Module' : 'New Module'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Module Title *</label>
            <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Introduction to Algebra" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-16 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What will students learn?" />
          </div>
          <div>
            <label className="label">Schedule Release <span className="text-gray-600">(drip content)</span></label>
            <input type="date" className="input" value={form.scheduledAt} onChange={e => setForm({...form, scheduledAt: e.target.value})} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setForm({...form, isPublished: !form.isPublished})}>
            <div className={`w-10 h-5 rounded-full transition-colors ${form.isPublished ? 'bg-primary-500' : 'bg-dark-500'} relative flex-shrink-0`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-300">Publish module</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Saving...' : module ? '✅ Update' : '➕ Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
