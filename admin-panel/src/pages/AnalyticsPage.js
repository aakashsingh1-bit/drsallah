import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../api';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#13131f',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      cornerRadius: 10,
      titleColor: '#e5e7eb',
      bodyColor: '#9ca3af',
      padding: 12,
    },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: '#4b5563', font: { size: 11 } } },
  },
};

export default function AnalyticsPage() {
  const [growth, setGrowth] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [videoStats, setVideoStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardAPI.getUserGrowth(),
      dashboardAPI.getRevenue(),
      dashboardAPI.getVideoAnalytics(),
    ]).then(([g, r, v]) => {
      setGrowth(g.data.data || []);
      setRevenue(r.data.data?.monthly || []);
      setVideoStats(v.data.data || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const growthData = {
    labels: growth.map(g => g._id),
    datasets: [{
      label: 'New Students',
      data: growth.map(g => g.count),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139,92,246,0.08)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#8b5cf6',
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
    }],
  };

  const revenueData = {
    labels: revenue.map(r => r._id),
    datasets: [{
      label: 'Revenue ($)',
      data: revenue.map(r => r.total),
      backgroundColor: (ctx) => {
        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(139,92,246,0.8)');
        gradient.addColorStop(1, 'rgba(139,92,246,0.2)');
        return gradient;
      },
      borderRadius: 6,
      borderSkipped: false,
      borderWidth: 0,
    }],
  };

  const playbackData = {
    labels: (videoStats?.dailyPlayback || []).slice(0,14).reverse().map(d => d._id?.split('-').slice(1).join('/')),
    datasets: [{
      label: 'Playbacks',
      data: (videoStats?.dailyPlayback || []).slice(0,14).reverse().map(d => d.count),
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6,182,212,0.08)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#06b6d4',
      pointRadius: 3,
      borderWidth: 2,
    }],
  };

  const topLessons = videoStats?.topLessons || [];
  const totalRevenue = revenue.reduce((s, m) => s + m.total, 0);
  const totalStudents = growth.reduce((s, m) => s + m.count, 0);

  if (loading) return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[...Array(4)].map((_,i) => <div key={i} className="card h-64 skeleton"/>)}
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub">Platform growth, revenue, and engagement insights</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/[0.04] px-3 py-2 rounded-xl border border-white/[0.07]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          Live Data
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, sub: 'All time', icon: '💰', color: 'text-emerald-400' },
          { label: 'Total Students', value: totalStudents.toLocaleString(), sub: 'Registered', icon: '👥', color: 'text-violet-400' },
          { label: 'Total Playbacks', value: (videoStats?.dailyPlayback?.reduce((s,d) => s+d.count,0)||0).toLocaleString(), sub: 'Last 30 days', icon: '▶️', color: 'text-blue-400' },
          { label: 'Top Lesson Views', value: topLessons[0]?.totalViews?.toLocaleString() || '—', sub: topLessons[0]?.title?.slice(0,20) || 'N/A', icon: '🏆', color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="card p-4 card-hover">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{s.icon}</span>
            </div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-gray-600 mt-0.5 truncate">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-white">Student Growth</p>
              <p className="text-xs text-gray-500 mt-0.5">Monthly registrations</p>
            </div>
            <span className="badge-purple">Monthly</span>
          </div>
          <div className="h-48">
            <Line data={growthData} options={chartBase} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-white">Revenue</p>
              <p className="text-xs text-gray-500 mt-0.5">Monthly earnings (USD)</p>
            </div>
            <span className="badge-green">$</span>
          </div>
          <div className="h-48">
            <Bar data={revenueData} options={chartBase} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-white">Video Playbacks</p>
              <p className="text-xs text-gray-500 mt-0.5">Last 14 days</p>
            </div>
            <span className="badge-blue">▶️</span>
          </div>
          <div className="h-48">
            <Line data={playbackData} options={chartBase} />
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold text-white mb-4">Top Lessons</p>
          <div className="space-y-3">
            {topLessons.slice(0, 6).map((lesson, i) => (
              <div key={lesson._id} className="flex items-center gap-3">
                <span className={`text-xs font-black w-5 flex-shrink-0 ${i < 3 ? 'text-amber-400' : 'text-gray-600'}`}>#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate">{lesson.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1 bg-white/[0.07] rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, (lesson.totalViews / (topLessons[0]?.totalViews||1)) * 100)}%` }}/>
                    </div>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{lesson.totalViews?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
            {topLessons.length === 0 && <p className="text-xs text-gray-500 text-center py-6">No data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
