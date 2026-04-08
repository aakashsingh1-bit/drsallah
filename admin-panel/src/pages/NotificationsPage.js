import React, { useState } from 'react';
import { notificationsAPI } from '../api';
import toast from 'react-hot-toast';
import { IconSend, IconBell, IconUsers, IconAlertTriangle, IconBook, IconClock, IconCheckCircle } from '../components/Icons';

const TEMPLATES = [
  { title: 'New Course Available', body: 'A new course has just been published. Check it out now in your learning dashboard.', type: 'new_content', Icon: IconBook, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/15' },
  { title: 'Subscription Expiring Soon', body: 'Your subscription expires in 3 days. Renew now to continue accessing all content.', type: 'subscription_expiry', Icon: IconClock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/15' },
  { title: 'Security Alert', body: 'Unusual activity was detected on your account. Please verify your recent login.', type: 'security_alert', Icon: IconAlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/15' },
  { title: 'Platform Announcement', body: 'We have made improvements to the platform. Enjoy a better learning experience!', type: 'general', Icon: IconBell, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/15' },
];

const TYPE_COLOR = { new_content: 'badge-blue', subscription_expiry: 'badge-yellow', security_alert: 'badge-red', general: 'badge-purple' };

export default function NotificationsPage() {
  const [form, setForm] = useState({ title: '', body: '', type: 'general', targetAll: true, userIds: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState([]);

  const apply = t => setForm(f => ({ ...f, title: t.title, body: t.body, type: t.type }));

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
      toast.success(data.message || 'Notification sent');
      setSent(h => [{ ...payload, sentAt: new Date(), id: Date.now() }, ...h.slice(0,9)]);
      setForm({ title: '', body: '', type: 'general', targetAll: true, userIds: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-wrap anim-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Broadcast push notifications to students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-5">

          {/* Templates */}
          <div>
            <p className="field-label mb-3">Quick Templates</p>
            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATES.map((t,i) => (
                <button key={i} onClick={() => apply(t)}
                  className={`text-left p-3.5 rounded-xl bg-white/[0.03] border ${t.border} hover:bg-white/[0.05] transition-all group`}>
                  <div className={`w-7 h-7 rounded-lg ${t.bg} flex items-center justify-center ${t.color} mb-2.5`}>
                    <t.Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className={`text-[12px] font-semibold ${t.color} line-clamp-1`}>{t.title}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">{t.body}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Compose */}
          <form onSubmit={handleSend} className="card p-5 space-y-4">
            <p className="text-[14px] font-semibold text-white mb-1">Compose Notification</p>

            <div>
              <label className="field-label">Title *</label>
              <input className="field-input" placeholder="Notification title..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            </div>

            <div>
              <label className="field-label">Message *</label>
              <textarea className="field-textarea min-h-[96px]" placeholder="Your message..." value={form.body} onChange={e => setForm({...form, body: e.target.value})} required />
            </div>

            <div>
              <label className="field-label">Type</label>
              <select className="field-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="general">General Announcement</option>
                <option value="new_content">New Content</option>
                <option value="subscription_expiry">Subscription Expiry</option>
                <option value="security_alert">Security Alert</option>
              </select>
            </div>

            <div>
              <label className="field-label">Recipients</label>
              <div className="flex gap-2">
                {[{ v: true, l: 'All Students', Icon: IconUsers }, { v: false, l: 'Specific Users', Icon: IconBell }].map(opt => (
                  <button key={String(opt.v)} type="button" onClick={() => setForm({...form, targetAll: opt.v})}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all border ${form.targetAll===opt.v ? 'bg-indigo-600/80 text-white border-indigo-500/40 shadow-lg shadow-indigo-600/15' : 'bg-white/[0.04] text-gray-400 border-white/[0.07] hover:text-white'}`}>
                    <opt.Icon className="w-3.5 h-3.5" />{opt.l}
                  </button>
                ))}
              </div>
              {!form.targetAll && (
                <div className="mt-3">
                  <textarea className="field-textarea min-h-[60px]" placeholder="Paste User IDs separated by commas..." value={form.userIds} onChange={e => setForm({...form, userIds: e.target.value})} />
                  <p className="text-[11px] text-gray-700 mt-1">{form.userIds.split(',').filter(s=>s.trim()).length} user(s) selected</p>
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-[14px]" disabled={sending}>
              {sending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Sending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconSend className="w-4 h-4" />
                  Send Notification{form.targetAll ? ' to All Students' : ''}
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Right: Preview + History */}
        <div className="space-y-5">
          {/* Preview */}
          <div>
            <p className="field-label mb-3">Live Preview</p>
            <div className="card p-4">
              <div className="bg-[#18181f] rounded-2xl p-4 border border-white/[0.05]">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <span className="text-white font-black text-xs">DS</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-white">Dr. Sallah Platform</p>
                    <p className="text-[10px] text-gray-600">now</p>
                  </div>
                </div>
                <p className="text-[13px] font-semibold text-white">{form.title || 'Notification Title'}</p>
                <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{form.body || 'Your message will appear here...'}</p>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className={`${TYPE_COLOR[form.type]||'badge-gray'} text-[10px]`}>{form.type.replace('_',' ')}</span>
                <span className="text-[11px] text-gray-600">{form.targetAll ? 'All Students' : `${form.userIds.split(',').filter(s=>s.trim()).length} users`}</span>
              </div>
            </div>
          </div>

          {/* History */}
          {sent.length > 0 && (
            <div>
              <p className="field-label mb-3">Recently Sent</p>
              <div className="space-y-2">
                {sent.map(n => (
                  <div key={n.id} className="card-sm p-3">
                    <p className="text-[12px] font-semibold text-white line-clamp-1">{n.title}</p>
                    <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">{n.body}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`${TYPE_COLOR[n.type]||'badge-gray'} text-[10px]`}>{n.type.replace('_',' ')}</span>
                      <span className="text-[10px] text-gray-700">{new Date(n.sentAt).toLocaleTimeString()}</span>
                    </div>
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
