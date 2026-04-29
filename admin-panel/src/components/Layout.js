import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import {
  IconDashboard, IconAnalytics, IconCourses, IconUsers,
  IconSecurity, IconBell, IconSearch, IconChevronDown, IconChevronLeft,
  IconChevronRight, IconLogout, IconSettings, IconUser,
  IconCheckCircle, IconAlertCircle, IconZap, IconRefresh, IconVideo,
  IconImage, IconStar,
} from './Icons';

const NAV = [
  { group: 'Overview', items: [
    { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
    { to: '/analytics', label: 'Analytics', Icon: IconAnalytics },
  ]},
  { group: 'Content', items: [
    { to: '/courses', label: 'Courses', Icon: IconCourses },
    { to: '/gallery', label: 'Gallery', Icon: IconImage },
  ]},
  { group: 'Users', items: [
    { to: '/users', label: 'Students', Icon: IconUsers },
    { to: '/purchases', label: 'Purchases', Icon: IconVideo },
    { to: '/reviews', label: 'Reviews', Icon: IconStar },
  ]},
  { group: 'System', items: [
    { to: '/security', label: 'Security', Icon: IconSecurity },
    { to: '/notifications', label: 'Notifications', Icon: IconBell },
    { to: '/settings', label: 'Settings', Icon: IconSettings },
  ]},
];


const DEMO_NOTIFS = [
  { id: 1, Icon: IconAlertCircle, color: 'text-red-500', bg: 'bg-red-50', title: 'Screen recording attempt detected', sub: '2 minutes ago', unread: true },
  { id: 2, Icon: IconUser, color: 'text-blue-500', bg: 'bg-blue-50', title: 'New student: Ahmed Ali registered', sub: '15 minutes ago', unread: true },
  { id: 3, Icon: IconZap, color: 'text-green-600', bg: 'bg-green-50', title: 'New yearly subscription activated', sub: '1 hour ago', unread: true },
  { id: 4, Icon: IconCheckCircle, color: 'text-orange-500', bg: 'bg-orange-50', title: 'Course "Physics 101" published', sub: '3 hours ago', unread: false },
];

function DropPanel({ open, children, width = 'w-52' }) {
  if (!open) return null;
  return (
    <div className={`absolute right-0 top-[calc(100%+6px)] ${width} bg-white border border-[#e8e6e0] rounded-xl shadow-card-lg z-50 animate-scale-in overflow-hidden`}>
      {children}
    </div>
  );
}

const PAGE_TITLES = {
  '/': 'Dashboard', '/analytics': 'Analytics', '/courses': 'Courses',
  '/users': 'Students', '/purchases': 'Purchases', '/reviews': 'Reviews', '/gallery': 'Gallery',
  '/security': 'Security', '/notifications': 'Notifications', '/settings': 'Settings',
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(DEMO_NOTIFS);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const h = e => {
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false);
      if (!notifRef.current?.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const closeAll = () => { setProfileOpen(false); setNotifOpen(false); };
  const unread = notifs.filter(n => n.unread).length;

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, unread: false })));
  const pageTitle = Object.entries(PAGE_TITLES).find(([k]) => k === location.pathname)?.[1] ||
    (location.pathname.startsWith('/courses/') ? 'Course Detail' :
     location.pathname.startsWith('/users/') ? 'Student Detail' : 'Dr. Sallah');

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f4f0]">

      {/* ══════════════════ SIDEBAR ══════════════════════════════════════════ */}
      <aside
        className={`sidebar-panel flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out
                    ${collapsed ? 'w-[58px]' : 'w-[228px]'}`}
      >
        {/* Brand */}
        <div className={`h-[60px] flex items-center border-b border-white/[0.07] flex-shrink-0
                        ${collapsed ? 'px-3.5 justify-center' : 'px-4 gap-2.5'}`}>
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/30">
            <span className="text-white font-black text-[11px] tracking-tight">DS</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white leading-none truncate">Dr. Sallah</p>
                <p className="text-[10px] text-white/40 mt-0.5">Admin Portal</p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
              >
                <IconChevronLeft className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="absolute left-0 w-full flex items-center justify-center"
              style={{ display: 'none' }}
            />
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
          >
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              {!collapsed && (
                <p className="sidebar-group-label mb-2">{group}</p>
              )}
              {collapsed && <div className="h-px bg-white/[0.06] mx-2 mb-3" />}
              <div className="space-y-0.5">
                {items.map(({ to, label, Icon, end }) => (
                  <NavLink
                    key={to} to={to} end={end}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `sidebar-nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center !px-0 !pl-0 !border-l-0 !rounded-lg' : ''}`
                    }
                  >
                    <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/[0.07] p-2 flex-shrink-0">
          {collapsed ? (
            <div className="flex justify-center py-1.5">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-[11px] font-bold text-brand-400">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-[11px] font-bold text-brand-400 flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white leading-none truncate">{user?.name}</p>
                <p className="text-[10px] text-white/35 mt-0.5">Administrator</p>
              </div>
              <div className="dot-green flex-shrink-0" />
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════════ MAIN ════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
        <header className="topbar-panel h-[60px] flex items-center px-5 gap-3 flex-shrink-0 z-30">

          {/* Breadcrumb / Page title */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#1c1d1f] truncate">{pageTitle}</p>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-[#f5f4f0] border border-[#e0ddd6] rounded-lg px-3 py-2 w-56 focus-within:border-brand-400 focus-within:bg-white focus-within:shadow-soft transition-all">
            <IconSearch className="w-3.5 h-3.5 text-[#9e9e9e] flex-shrink-0" />
            <input className="bg-transparent text-[13px] text-[#1c1d1f] placeholder-[#9e9e9e] outline-none flex-1 min-w-0" placeholder="Search..." />
            <kbd className="text-[10px] text-[#b0afab] bg-white px-1.5 py-0.5 rounded border border-[#e0ddd6] font-mono hidden lg:block">⌘K</kbd>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { closeAll(); setNotifOpen(!notifOpen); }}
              className="btn-icon relative border border-transparent hover:border-[#e0ddd6]"
            >
              <IconBell className="w-[17px] h-[17px]" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                  {unread}
                </span>
              )}
            </button>
            <DropPanel open={notifOpen} width="w-[360px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0ece4]">
                <p className="text-[14px] font-bold text-[#1c1d1f]">Notifications</p>
                <div className="flex items-center gap-3">
                  {unread > 0 && <span className="badge-orange">{unread} new</span>}
                  <button onClick={markAllRead} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                    Mark all read
                  </button>
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => setNotifs(p => p.map(x => x.id === n.id ? { ...x, unread: false } : x))}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer border-b border-[#f5f4f0] last:border-0 hover:bg-[#faf9f6] transition-colors ${n.unread ? 'bg-orange-50/40' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${n.bg} flex items-center justify-center flex-shrink-0 mt-0.5 ${n.color}`}>
                      <n.Icon className="w-[15px] h-[15px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#1c1d1f] leading-snug">{n.title}</p>
                      <p className="text-[11px] text-[#9e9e9e] mt-1">{n.sub}</p>
                    </div>
                    {n.unread && <div className="dot-orange mt-2 flex-shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-[#f0ece4]">
                <button
                  onClick={() => { navigate('/notifications'); setNotifOpen(false); }}
                  className="w-full text-[12px] font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                >
                  View all notifications →
                </button>
              </div>
            </DropPanel>
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { closeAll(); setProfileOpen(!profileOpen); }}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-[#f0ece4] border border-transparent hover:border-[#e0ddd6] transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm shadow-brand-500/30 flex-shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[12px] font-semibold text-[#1c1d1f] leading-none">{user?.name?.split(' ')[0]}</p>
                <p className="text-[10px] text-[#9e9e9e] mt-0.5">Admin</p>
              </div>
              <IconChevronDown className="w-3 h-3 text-[#b0afab] hidden sm:block" />
            </button>
            <DropPanel open={profileOpen} width="w-52">
              <div className="px-4 py-3.5 border-b border-[#f0ece4]">
                <p className="text-[13px] font-bold text-[#1c1d1f]">{user?.name}</p>
                <p className="text-[11px] text-[#9e9e9e] mt-0.5 truncate">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="dot-green" />
                  <span className="text-[11px] font-medium text-emerald-600">Online</span>
                </div>
              </div>
              <div className="py-1">
                {[
                  { label: 'My Profile', to: '/settings', Icon: IconUser },
                  { label: 'Settings', to: '/settings', Icon: IconSettings },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { navigate(item.to); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#3d3d3d] hover:bg-[#f5f4f0] hover:text-[#1c1d1f] transition-colors"
                  >
                    <item.Icon className="w-4 h-4 text-[#9e9e9e]" />
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-[#f0ece4] py-1">
                <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors">
                  <IconLogout className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </DropPanel>
          </div>
        </header>

        {/* ── PAGE CONTENT ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f5f4f0]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
