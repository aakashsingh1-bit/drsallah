import React, { useEffect, useState } from 'react';
import { notificationsAPI, usersAPI } from '../api';
import toast from 'react-hot-toast';

const TEMPLATES = [
  { title: '🎉 New Course Available', body: 'A new course has been published! Check it out now in your learning dashboard.', type: 'new_content' },
  { title: '⏰ Subscription Expiring', body: 'Your subscription expires in 3 days. Renew now to continue accessing all content.', type: 'subscription_expiry' },
  { title: '🚨 Security Alert', body: 'Unusual activity was detected on your account. Please verify your login.', type: 'security_alert' },
  { title: '📢 Platform Update', body: 'We have made improvements to the platform. Enjoy a better learning experience!', type: 'general' },
];

export default function NotificationsPage() {
  const [form, setForm] = useState({ title: '', body: '', type: 'general', targetAll: true, userIds: '' });
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  const applyTemplate = (t) => setForm(f => ({ ...f, title: t.title, body: t.body, type: t.type }));

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return toast.error('Title and message are required');
    setSending(true);
    try {
      const payload = { title: form.title, body: form.body, type: form.type };
      if (!form.targetAll && form.userIds.trim()) {
        payload.userIds = form.userIds.split(',').map(s => s.trim()).filter(Boolean);
      }
      const { data } = await notificationsAPI.broadcast(payload);
      toast.success(data.message || 'Notification sent!');
      setHistory(h => [{ ...payload, sentAt: new Date(), id: Date.now() }, ...h.slice(0, 9)]);
      setForm({ title: '', body: '', type: 'general', targetAll: true, userIds: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const TYPE_COLORS = { new_content: 'badge-blue', subscription_expiry: 'badge-yellow', security_alert: 'badge-red', general: 'badge-purple' };
  const TYPE_ICONS = { new_content: '🎓', subscription_expiry: '💳', security_alert: '🚨', general: '📢' };

  return (
    <div className="p-6 space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">Broadcast push notifications to students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Templates */}
          <div>
            <p className="label mb-3">Quick Templates</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => applyTemplate(t)}
                  className="text-left p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group"
                >
                  <p className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">{t.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{t.body}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="card p-5 space-y-4">
            <div>
              <label className="label">Notification Title *</label>
              <input className="input" placeholder="Enter notification title..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            </div>

            <div>
              <label className="label">Message *</label>
              <textarea className="textarea min-h-24" placeholder="Enter your message..." value={form.body} onChange={e => setForm({...form, body: e.target.value})} required />
            </div>

            <div>
              <label className="label">Notification Type</label>
              <select className="select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="general">📢 General</option>
                <option value="new_content">🎓 New Content</option>
                <option value="subscription_expiry">💳 Subscription Expiry</option>
                <option value="security_alert">🚨 Security Alert</option>
              </select>
            </div>

            <div>
              <label className="label">Recipients</label>
              <div className="flex gap-2">
                {[{ v: true, l: '👥 All Students' }, { v: false, l: '🎯 Specific Users' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => setForm({...form, targetAll: opt.v})}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${form.targetAll === opt.v ? 'bg-violet-600/80 text-white border-violet-500/50' : 'bg-white/[0.04] text-gray-400 border-white/[0.07] hover:text-white'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {!form.targetAll && (
                <div className="mt-3">
                  <textarea
                    className="textarea min-h-16"
                    placeholder="Paste User IDs separated by commas: 64abc..., 64def..."
                    value={form.userIds}
                    onChange={e => setForm({...form, userIds: e.target.value})}
                  />
                  <p className="text-xs text-gray-600 mt-1">{form.userIds.split(',').filter(s=>s.trim()).length} user(s) selected</p>
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full py-3" disabled={sending}>
              {sending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Sending...
                </span>
              ) : `🚀 Send Notification${form.targetAll ? ' to All' : ''}`}
            </button>
          </form>
        </div>

        {/* Preview + History */}
        <div className="space-y-5">
          {/* Live Preview */}
          <div>
            <p className="label mb-3">Preview</p>
            <div className="card p-4">
              <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-2 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-sm">DS</div>
                  <div>
                    <p className="text-xs font-bold text-white">Dr. Sallah Platform</p>
                    <p className="text-[10px] text-gray-500">now</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white">{form.title || 'Notification Title'}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{form.body || 'Your message will appear here...'}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className={TYPE_COLORS[form.type]||'badge-gray'}>
                  {TYPE_ICONS[form.type]} {form.type.replace('_',' ')}
                </span>
                <span className="text-xs text-gray-500">{form.targetAll ? 'All Students' : `${form.userIds.split(',').filter(s=>s.trim()).length} users`}</span>
              </div>
            </div>
          </div>

          {/* Sent History */}
          {history.length > 0 && (
            <div>
              <p className="label mb-3">Recent Sent</p>
              <div className="space-y-2">
                {history.map(n => (
                  <div key={n.id} className="card p-3 space-y-1">
                    <p className="text-xs font-semibold text-white line-clamp-1">{n.title}</p>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{n.body}</p>
                    <p className="text-[10px] text-gray-600">{new Date(n.sentAt).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
