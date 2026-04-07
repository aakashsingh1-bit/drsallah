import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const chartBase = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#13131f', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, cornerRadius: 10, titleColor: '#e5e7eb', bodyColor: '#9ca3af', padding: 12 },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 10 } } },
  },
};

const STAT_CARDS = (stats) => [
  { label: 'Total Students', value: stats?.totalUsers?.toLocaleString() || '0', icon: '👥', change: '+12%', positive: true, color: 'from-violet-500/10 to-transparent', border: 'border-violet-500/20' },
  { label: 'Active Subscriptions', value: stats?.activeSubscriptions?.toLocaleString() || '0', icon: '💳', change: '+8%', positive: true, color: 'from-emerald-500/10 to-transparent', border: 'border-emerald-500/20' },
  { label: 'Monthly Revenue', value: `$${stats?.monthlyRevenue?.toFixed(0) || 0}`, icon: '💰', change: '+5%', positive: true, color: 'from-amber-500/10 to-transparent', border: 'border-amber-500/20' },
  { label: 'Total Courses', value: stats?.totalCourses || '0', icon: '🎓', sub: `${stats?.totalLessons || 0} lessons`, color: 'from-blue-500/10 to-transparent', border: 'border-blue-500/20' },
  { label: 'Critical Alerts', value: stats?.criticalLogs24h || '0', icon: '🚨', sub: 'Last 24h', color: 'from-red-500/10 to-transparent', border: 'border-red-500/20', alert: stats?.criticalLogs24h > 0 },
  { label: 'Flagged Users', value: stats?.flaggedUsers || '0', icon: '🚩', sub: 'Need review', color: 'from-orange-500/10 to-transparent', border: 'border-orange-500/20' },
  { label: 'Suspended', value: stats?.suspendedUsers || '0', icon: '🚫', sub: 'Accounts', color: 'from-red-600/10 to-transparent', border: 'border-red-600/20' },
  { label: 'Video Lessons', value: stats?.totalLessons || '0', icon: '📹', sub: 'Published', color: 'from-cyan-500/10 to-transparent', border: 'border-cyan-500/20' },
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

  const growthData = {
    labels: growth.map(g => g._id),
    datasets: [{
      data: growth.map(g => g.count),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139,92,246,0.06)',
      fill: true, tension: 0.4,
      pointBackgroundColor: '#8b5cf6', pointRadius: 3, borderWidth: 2,
    }],
  };

  const revenueData = {
    labels: revenue.map(r => r._id),
    datasets: [{
      data: revenue.map(r => r.total),
      backgroundColor: 'rgba(139,92,246,0.6)',
      borderRadius: 5, borderSkipped: false, borderWidth: 0,
    }],
  };

  const subDist = {
    labels: ['Active', 'Expired', 'Cancelled'],
    datasets: [{ data: [stats?.activeSubscriptions||0, 35, 12], backgroundColor: ['#8b5cf6','#374151','#ef4444'], borderWidth: 0, hoverOffset: 6 }],
  };

  const cards = STAT_CARDS(stats);

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          All systems operational
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_,i) => <div key={i} className="card h-24 skeleton"/>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c, i) => (
            <div key={i} className={`card p-4 bg-gradient-to-br ${c.color} border ${c.border} card-hover relative overflow-hidden`}>
              {c.alert && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping"/>}
              <div className="flex items-start justify-between mb-2">
                <span className="text-xl">{c.icon}</span>
                {c.change && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${c.positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{c.change}</span>}
              </div>
              <p className="text-2xl font-black text-white">{c.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
              {c.sub && <p className="text-[10px] text-gray-600 mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-white">Student Growth</p>
              <p className="text-xs text-gray-500 mt-0.5">Monthly registrations</p>
            </div>
            <span className="badge-purple">Monthly</span>
          </div>
          <div className="h-48">
            <Line data={growthData} options={chartBase}/>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-white">Subscriptions</p>
              <p className="text-xs text-gray-500 mt-0.5">By status</p>
            </div>
          </div>
          <div className="h-40">
            <Doughnut data={subDist} options={{ ...chartBase, scales: undefined, plugins: { ...chartBase.plugins, legend: { display: true, position: 'bottom', labels: { color: '#6b7280', boxWidth: 10, font: { size: 10 } } } } }}/>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-white">Revenue Trend</p>
            <p className="text-xs text-gray-500 mt-0.5">Monthly earnings (USD)</p>
          </div>
          <span className="badge-green text-sm font-bold">
            ${revenue.reduce((s,r) => s+r.total, 0).toLocaleString()} total
          </span>
        </div>
        <div className="h-44">
          <Bar data={revenueData} options={chartBase}/>
        </div>
      </div>

      {/* Recent users + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-white">Recent Students</p>
            <Link to="/users" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">View all →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? [...Array(4)].map((_,i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="skeleton w-8 h-8 rounded-full"/>
                <div className="flex-1 space-y-1.5"><div className="skeleton h-3 w-32"/><div className="skeleton h-2 w-48"/></div>
              </div>
            )) : (stats?.recentUsers || []).map(u => (
              <Link to={`/users/${u._id}`} key={u._id} className="flex items-center gap-3 py-3 hover:bg-white/[0.02] transition-colors rounded-lg px-1 -mx-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {u.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
                <span className="text-xs text-gray-600 flex-shrink-0">{new Date(u.createdAt).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-bold text-white mb-4">Quick Actions</p>
          <div className="space-y-2">
            {[
              { icon: '🎓', label: 'Add New Course', to: '/courses', color: 'hover:bg-violet-500/10 hover:border-violet-500/30' },
              { icon: '👥', label: 'Manage Students', to: '/users', color: 'hover:bg-blue-500/10 hover:border-blue-500/30' },
              { icon: '💳', label: 'View Subscriptions', to: '/subscriptions', color: 'hover:bg-emerald-500/10 hover:border-emerald-500/30' },
              { icon: '🛡️', label: 'Security Logs', to: '/security', color: 'hover:bg-red-500/10 hover:border-red-500/30' },
              { icon: '📊', label: 'Analytics', to: '/analytics', color: 'hover:bg-amber-500/10 hover:border-amber-500/30' },
              { icon: '🔔', label: 'Send Notification', to: '/notifications', color: 'hover:bg-cyan-500/10 hover:border-cyan-500/30' },
            ].map(a => (
              <Link key={a.to} to={a.to} className={`flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] ${a.color} transition-all group`}>
                <span className="text-base">{a.icon}</span>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{a.label}</span>
                <svg className="w-3.5 h-3.5 text-gray-600 ml-auto group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
