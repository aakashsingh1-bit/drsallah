import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: <IconDashboard />, exact: true },
      { to: '/analytics', label: 'Analytics', icon: <IconChart /> },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/courses', label: 'Courses', icon: <IconCourses /> },
    ],
  },
  {
    label: 'Users',
    items: [
      { to: '/users', label: 'Students', icon: <IconUsers /> },
      { to: '/subscriptions', label: 'Subscriptions', icon: <IconSub /> },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/security', label: 'Security', icon: <IconShield /> },
      { to: '/notifications', label: 'Notifications', icon: <IconBell /> },
    ],
  },
];

const LANGS = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const profileRef = useRef(null);
  const langRef = useRef(null);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  // Page title from route
  const routeTitles = { '/': 'Dashboard', '/courses': 'Courses', '/users': 'Students', '/subscriptions': 'Subscriptions', '/security': 'Security', '/notifications': 'Notifications', '/analytics': 'Analytics' };
  const pageTitle = routeTitles[location.pathname] || 'Dr. Sallah Admin';

  return (
    <div className="flex h-screen bg-[#0d0d14] overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} flex-shrink-0 bg-[#10101a] border-r border-white/[0.06] flex flex-col transition-all duration-300 ease-in-out`}>
        
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/[0.06] gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-violet-500/20 flex-shrink-0">
            DS
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm leading-none truncate">Dr. Sallah</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Admin Panel</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-icon w-7 h-7 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={sidebarOpen ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 px-3">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon, exact }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    title={!sidebarOpen ? label : undefined}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-2' : ''}`}
                  >
                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">{icon}</span>
                    {sidebarOpen && <span className="truncate">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom user section */}
        <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => setProfileOpen(!profileOpen)}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-gray-500 truncate">Administrator</p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white cursor-pointer">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top Bar ───────────────────────────────────────── */}
        <header className="h-16 topbar-gradient border-b border-white/[0.06] flex items-center px-6 gap-4 flex-shrink-0 z-20">
          
          {/* Page title / breadcrumb */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">{pageTitle}</h1>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 w-56 group focus-within:border-violet-500/50 transition-colors">
            <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input className="bg-transparent text-sm text-white placeholder-gray-600 outline-none flex-1 min-w-0" placeholder="Search..." />
            <kbd className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </div>

          {/* Language Switcher */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => { setLangOpen(!langOpen); setNotifOpen(false); setProfileOpen(false); }}
              className="btn-icon gap-2 px-3 w-auto text-xs font-medium text-gray-300"
            >
              <span>{LANGS.find(l => l.code === lang)?.flag}</span>
              <span className="hidden sm:block">{LANGS.find(l => l.code === lang)?.code.toUpperCase()}</span>
              <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-12 w-36 card border-white/[0.1] shadow-2xl z-50 py-1 animate-in">
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false); toast.success(`Language: ${l.label}`); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.05] transition-colors ${lang === l.code ? 'text-violet-400' : 'text-gray-300'}`}>
                    <span>{l.flag}</span><span>{l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); setLangOpen(false); }}
              className="btn-icon relative"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 card border-white/[0.1] shadow-2xl z-50 overflow-hidden animate-in">
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                  <p className="font-semibold text-white text-sm">Notifications</p>
                  <span className="badge-red text-[10px] px-1.5 py-0.5">3 new</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {[
                    { icon: '🚨', text: 'Screen recording attempt detected', time: '2m ago', color: 'text-red-400' },
                    { icon: '👤', text: 'New student registered: Ahmed Ali', time: '15m ago', color: 'text-blue-400' },
                    { icon: '💳', text: 'New subscription: Yearly plan', time: '1h ago', color: 'text-emerald-400' },
                  ].map((n, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 hover:bg-white/[0.03] border-b border-white/[0.04] cursor-pointer transition-colors">
                      <span className="text-base flex-shrink-0 mt-0.5">{n.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${n.color}`}>{n.text}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/[0.06]">
                  <button onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                    className="w-full text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">
                    View all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); setLangOpen(false); }}
              className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-violet-500/20">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white leading-none">{user?.name?.split(' ')[0]}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Admin</p>
              </div>
              <svg className="w-3 h-3 text-gray-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 w-52 card border-white/[0.1] shadow-2xl z-50 py-1 animate-in">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white">{user?.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{user?.email}</p>
                </div>
                {[
                  { icon: '👤', label: 'My Profile' },
                  { icon: '⚙️', label: 'Settings' },
                ].map(item => (
                  <button key={item.label} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors">
                    <span className="text-base">{item.icon}</span>{item.label}
                  </button>
                ))}
                <div className="border-t border-white/[0.06] mt-1 pt-1">
                  <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── Page Content ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ── SVG Icons ──────────────────────────────────────────────────── */
function IconDashboard() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.8}/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.8}/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.8}/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.8}/></svg>; }
function IconChart() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>; }
function IconCourses() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>; }
function IconUsers() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>; }
function IconSub() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>; }
function IconShield() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>; }
function IconBell() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>; }
