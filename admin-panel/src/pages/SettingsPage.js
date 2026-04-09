import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { IconUser, IconLock, IconBell, IconGlobe, IconCheckCircle } from '../components/Icons';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [preferences, setPreferences] = useState({
    emailNotifs: true,
    pushNotifs: true,
    weeklyDigest: false,
    language: 'en',
    timezone: 'UTC',
  });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success('Profile updated successfully');
      setLoading(false);
    }, 800);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      toast.success('Password changed successfully');
      setPasswords({ current: '', new: '', confirm: '' });
      setLoading(false);
    }, 800);
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(p => ({ ...p, [key]: value }));
    toast.success('Preference saved');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', Icon: IconUser },
    { id: 'security', label: 'Security', Icon: IconLock },
    { id: 'notifications', label: 'Notifications', Icon: IconBell },
    { id: 'preferences', label: 'Preferences', Icon: IconGlobe },
  ];

  return (
    <div className="page-wrap animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage your account and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-2">
            <nav className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-[#6a6f73] hover:text-[#1c1d1f] hover:bg-[#f5f4f0]'
                  }`}
                >
                  <tab.Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <div className="card p-6">
              <h2 className="text-[16px] font-bold text-[#1c1d1f] mb-6">Profile Information</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div className="flex items-center gap-5 pb-5 border-b border-[#e8e6e0]">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-600 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-brand-500/20">
                    {user?.name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1c1d1f]">Profile Photo</p>
                    <p className="text-[12px] text-[#9e9e9e] mt-0.5">JPG, PNG or GIF. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="field-label">Full Name</label>
                    <input
                      type="text"
                      className="field-input"
                      value={profile.name}
                      onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label">Email Address</label>
                    <input
                      type="email"
                      className="field-input"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="field-label">Phone Number</label>
                    <input
                      type="tel"
                      className="field-input"
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="field-label">Role</label>
                    <input
                      type="text"
                      className="field-input bg-[#f5f4f0]"
                      value="Administrator"
                      disabled
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#e8e6e0]">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card p-6">
              <h2 className="text-[16px] font-bold text-[#1c1d1f] mb-6">Security Settings</h2>
              <form onSubmit={handlePasswordChange} className="space-y-5">
                <div className="pb-5 border-b border-[#e8e6e0]">
                  <p className="text-[14px] font-semibold text-[#1c1d1f] mb-4">Change Password</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="field-label">Current Password</label>
                      <input
                        type="password"
                        className="field-input"
                        value={passwords.current}
                        onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                    <div></div>
                    <div>
                      <label className="field-label">New Password</label>
                      <input
                        type="password"
                        className="field-input"
                        value={passwords.new}
                        onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="field-label">Confirm New Password</label>
                      <input
                        type="password"
                        className="field-input"
                        value={passwords.confirm}
                        onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <div className="pb-5 border-b border-[#e8e6e0]">
                  <p className="text-[14px] font-semibold text-[#1c1d1f] mb-4">Two-Factor Authentication</p>
                  <div className="flex items-center justify-between p-4 bg-[#f5f4f0] rounded-lg border border-[#e0ddd6]">
                    <div>
                      <p className="text-[13px] font-semibold text-[#1c1d1f]">Enable 2FA</p>
                      <p className="text-[12px] text-[#9e9e9e] mt-0.5">Add an extra layer of security to your account</p>
                    </div>
                    <button type="button" className="btn-secondary text-[12px]">Enable</button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6">
              <h2 className="text-[16px] font-bold text-[#1c1d1f] mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { key: 'emailNotifs', label: 'Email Notifications', desc: 'Receive email updates about platform activity' },
                  { key: 'pushNotifs', label: 'Push Notifications', desc: 'Get instant notifications on your device' },
                  { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Receive a weekly summary of analytics and activity' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-[#f5f4f0] rounded-lg border border-[#e0ddd6]">
                    <div>
                      <p className="text-[13px] font-semibold text-[#1c1d1f]">{item.label}</p>
                      <p className="text-[12px] text-[#9e9e9e] mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => handlePreferenceChange(item.key, !preferences[item.key])}
                      className={`w-11 h-6 rounded-full transition-all relative ${
                        preferences[item.key] ? 'bg-brand-500' : 'bg-[#d1d0cc]'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                        preferences[item.key] ? 'left-5.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="card p-6">
              <h2 className="text-[16px] font-bold text-[#1c1d1f] mb-6">Preferences</h2>
              <div className="space-y-5">
                <div>
                  <label className="field-label">Language</label>
                  <select
                    className="field-select max-w-xs"
                    value={preferences.language}
                    onChange={e => handlePreferenceChange('language', e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="ar">العربية (Arabic)</option>
                    <option value="fr">Français (French)</option>
                    <option value="es">Español (Spanish)</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">Timezone</label>
                  <select
                    className="field-select max-w-xs"
                    value={preferences.timezone}
                    onChange={e => handlePreferenceChange('timezone', e.target.value)}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-[#e8e6e0]">
                  <p className="text-[14px] font-semibold text-[#1c1d1f] mb-4">Data & Privacy</p>
                  <div className="space-y-3">
                    <button className="text-[13px] font-medium text-brand-600 hover:text-brand-700">
                      Download my data →
                    </button>
                    <button className="text-[13px] font-medium text-red-600 hover:text-red-700 block">
                      Delete my account →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}