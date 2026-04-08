import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import {
  IconUsers, IconSubscriptions, IconTrendUp, IconCourses,
  IconAlertTriangle, IconFlag, IconSecurity, IconVideo,
  IconChevronRight, IconArrowRight,
} from '../components/Icons';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const CHART = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#e8e6e0',
      borderWidth: 1,
      cornerRadius: 8,
      titleColor: '#1c1d1f',
      bodyColor: '#6a6f73',
      padding: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,.1)',
    },
  },
  scales: {
    x: { grid: { color: '#f0ece4', drawBorder: false }, ticks: { color: '#b0afab', font: { size: 11 } } },
    y: { grid: { color: '#f0ece4', drawBorder: false }, ticks: { color: '#b0afab', font: { size: 11 } } },
  },
};

const STAT_CARDS = s => [
  { label: 'Total Students',        value: s?.totalUsers?.toLocaleString() || '0',               change: '+12%', pos: true,  Icon: IconUsers,         iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   border: 'border-blue-100' },
  { label: 'Active Subscriptions',  value: s?.activeSubscriptions?.toLocaleString() || '0',       change: '+8%',  pos: true,  Icon: IconSubscriptions, iconBg: 'bg-green-50',  iconColor: 'text-green-600',  border: 'border-green-100' },
  { label: 'Monthly Revenue',       value: `$${s?.monthlyRevenue?.toFixed(0) || 0}`,              change: '+5%',  pos: true,  Icon: IconTrendUp,       iconBg: 'bg-orange-50', iconColor: 'text-orange-600', border: 'border-orange-100' },
  { label: 'Total Courses',         value: s?.totalCourses || '0',        sub: `${s?.totalLessons || 0} lessons`, Icon: IconCourses,       iconBg: 'bg-violet-50', iconColor: 'text-violet-600', border: 'border-violet-100' },
  { label: 'Critical Alerts (24h)', value: s?.criticalLogs24h || '0',      sub: 'Needs attention',    Icon: IconAlertTriangle, iconBg: 'bg-red-50',    iconColor: 'text-red-600',    border: 'border-red-100',  alert: s?.criticalLogs24h > 0 },
  { label: 'Flagged Users',         value: s?.flaggedUsers || '0',         sub: 'Require review',     Icon: IconFlag,          iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  border: 'border-amber-100' },
  { label: 'Suspended',             value: s?.suspendedUsers || '0',       sub: 'Inactive accounts',  Icon: IconSecurity,      iconBg: 'bg-rose-50',   iconColor: 'text-rose-600',   border: 'border-rose-100' },
  { label: 'Video Lessons',         value: s?.totalLessons || '0',         sub: 'Published content',  Icon: IconVideo,         iconBg: 'bg-sky-50',    iconColor: 'text-sky-600',    border: 'border-sky-100' },
];

const QUICK = [
  { label: 'Create New Course',  sub: 'Add course, modules & videos',   to: '/courses',       Icon: IconCourses,       iconBg: 'bg-violet-50', iconColor: 'text-violet-600', border: 'border-violet-100' },
  { label: 'Manage Students',    sub: 'View, suspend or reset devices', to: '/users',         Icon: IconUsers,         iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   border: 'border-blue-100' },
  { label: 'Security Logs',      sub: 'Review threats and alerts',      to: '/security',      Icon: IconSecurity,      iconBg: 'bg-red-50',    iconColor: 'text-red-600',    border: 'border-red-100' },
  { label: 'Subscriptions',      sub: 'Plans, billing & revenue',       to: '/subscriptions', Icon: IconSubscriptions, iconBg: 'bg-green-50',  iconColor: 'text-green-600',  border: 'border-green-100' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [growth, setGrowth] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardAPI.getStats(),
      dashboardAPI.getUserGrowth(),
      dashboardAPI.getRevenue(),
    ]).then(([s, g, r]) => {
      setStats(s.data.data);
      setGrowth(g.data.data || []);
      setRevenue(r.data.data?.monthly || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const growthChart = {
    labels: growth.map(g => g._id),
    datasets: [{
      data: growth.map(g => g.count),
      borderColor: '#f97316',
      backgroundColor: 'rgba(249,115,22,0.06)',
      fill: true, tension: 0.45,
      pointBackgroundColor: '#f97316', pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
    }],
  };

  const revenueChart = {
    labels: revenue.map(r => r._id),
    datasets: [{
      data: revenue.map(r => r.total),
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 240);
        g.addColorStop(0, 'rgba(249,115,22,0.75)');
        g.addColorStop(1, 'rgba(249,115,22,0.1)');
        return g;
      },
      borderRadius: 6, borderSkipped: false, borderWidth: 0,
    }],
  };

  const subChart = {
    labels: ['Active', 'Expired', 'Cancelled'],
    datasets: [{
      data: [stats?.activeSubscriptions || 0, 40, 15],
      backgroundColor: ['#f97316', '#e0ddd6', '#ef4444'],
      borderWidth: 2,
      borderColor: '#fff',
      hoverOffset: 6,
    }],
  };

  const totalRev = revenue.reduce((s, r) => s + (r.total || 0), 0);
  const cards = STAT_CARDS(stats);

  return (
    <div className="page-wrap animate-fade-up">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
          <div className="dot-green" />
          All Systems Operational
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <div key={i} className={`bg-white border ${c.border} rounded-xl p-4 shadow-soft hover:shadow-card transition-all duration-150 ${c.alert ? 'ring-2 ring-red-200' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center ${c.iconColor}`}>
                  <c.Icon className="w-[17px] h-[17px]" />
                </div>
                {c.change && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${c.pos ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {c.change}
                  </span>
                )}
              </div>
              <p className="stat-num">{c.value}</p>
              <p className="stat-label">{c.label}</p>
              {c.sub && <p className="text-[11px] text-[#9e9e9e] mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-title">Student Growth</p>
              <p className="section-sub">Monthly new registrations</p>
            </div>
            <span className="badge-orange">Monthly</span>
          </div>
          <div className="h-52"><Line data={growthChart} options={CHART} /></div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-title">Subscriptions</p>
              <p className="section-sub">By status</p>
            </div>
          </div>
          <div className="h-44">
            <Doughnut
              data={subChart}
              options={{
                ...CHART, scales: undefined,
                plugins: {
                  ...CHART.plugins,
                  legend: { display: true, position: 'bottom', labels: { color: '#6a6f73', boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 16 } }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="section-title">Revenue</p>
            <p className="section-sub">Monthly earnings (USD)</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-black text-[#1c1d1f]">${totalRev.toLocaleString()}</span>
            <span className="badge-green">All time</span>
          </div>
        </div>
        <div className="h-48"><Bar data={revenueChart} options={CHART} /></div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Recent students */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title">Recent Students</p>
            <Link to="/users" className="flex items-center gap-1 text-[12px] font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              View all <IconChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[#f5f4f0]">
            {loading
              ? [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-28 rounded" />
                      <div className="skeleton h-2.5 w-40 rounded" />
                    </div>
                    <div className="skeleton h-2.5 w-16 rounded" />
                  </div>
                ))
              : (stats?.recentUsers || []).map(u => (
                  <Link
                    to={`/users/${u._id}`}
                    key={u._id}
                    className="flex items-center gap-3 py-3 hover:bg-[#faf9f6] -mx-1 px-1 rounded-lg transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-[12px] font-bold text-brand-700 flex-shrink-0">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1c1d1f] truncate group-hover:text-brand-600 transition-colors">{u.name}</p>
                      <p className="text-[11px] text-[#9e9e9e] truncate">{u.email}</p>
                    </div>
                    <span className="text-[11px] text-[#b0afab] flex-shrink-0">{new Date(u.createdAt).toLocaleDateString()}</span>
                  </Link>
                ))
            }
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5 lg:col-span-2">
          <p className="section-title mb-4">Quick Actions</p>
          <div className="space-y-2.5">
            {QUICK.map(a => (
              <Link
                key={a.to}
                to={a.to}
                className={`flex items-center gap-3 p-3 rounded-xl border ${a.border} bg-white hover:shadow-soft transition-all group`}
              >
                <div className={`w-9 h-9 rounded-lg ${a.iconBg} flex items-center justify-center flex-shrink-0 ${a.iconColor}`}>
                  <a.Icon className="w-[17px] h-[17px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1c1d1f] group-hover:text-brand-600 transition-colors">{a.label}</p>
                  <p className="text-[11px] text-[#9e9e9e] truncate mt-0.5">{a.sub}</p>
                </div>
                <IconArrowRight className="w-3.5 h-3.5 text-[#b0afab] group-hover:text-brand-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
