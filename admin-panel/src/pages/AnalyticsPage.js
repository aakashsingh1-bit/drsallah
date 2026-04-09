import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../api';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js';
import { IconTrendUp, IconUsers, IconVideo, IconSubscriptions, IconClock } from '../components/Icons';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const CHART = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#fff', borderColor: '#e8e6e0', borderWidth: 1, cornerRadius: 8, titleColor: '#1c1d1f', bodyColor: '#6a6f73', padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
  },
  scales: {
    x: { grid: { color: '#f0ece4', drawBorder: false }, ticks: { color: '#b0afab', font: { size: 10 } } },
    y: { grid: { color: '#f0ece4', drawBorder: false }, ticks: { color: '#b0afab', font: { size: 10 } } },
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

  const growthChart = {
    labels: growth.map(g => g._id),
    datasets: [{
      label: 'Students',
      data: growth.map(g => g.count),
      borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.06)',
      fill: true, tension: 0.45,
      pointBackgroundColor: '#f97316', pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
    }],
  };

  const revenueChart = {
    labels: revenue.map(r => r._id),
    datasets: [{
      label: 'Revenue',
      data: revenue.map(r => r.total),
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
        g.addColorStop(0, 'rgba(249,115,22,0.75)');
        g.addColorStop(1, 'rgba(249,115,22,0.1)');
        return g;
      },
      borderRadius: 5, borderSkipped: false, borderWidth: 0,
    }],
  };

  const playbackChart = {
    labels: (videoStats?.dailyPlayback || []).slice(0,14).reverse().map(d => d._id?.split('-').slice(1).join('/')),
    datasets: [{
      label: 'Plays',
      data: (videoStats?.dailyPlayback || []).slice(0,14).reverse().map(d => d.count),
      borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.06)',
      fill: true, tension: 0.45,
      pointBackgroundColor: '#0ea5e9', pointRadius: 3, borderWidth: 2,
    }],
  };

  const topLessons = videoStats?.topLessons || [];
  const totalRev = revenue.reduce((s,r) => s + (r.total||0), 0);
  const totalStudents = growth.reduce((s,m) => s + (m.count||0), 0);
  const totalPlays = (videoStats?.dailyPlayback||[]).reduce((s,d) => s + (d.count||0), 0);

  if (loading) return (
    <div className="page-wrap grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[...Array(4)].map((_,i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
    </div>
  );

  return (
    <div className="page-wrap animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub">Growth, revenue and engagement insights</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
          <div className="dot-green" />
          Live Data
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totalRev.toLocaleString()}`, sub: 'All time', Icon: IconTrendUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Total Students', value: totalStudents.toLocaleString(), sub: 'All registered', Icon: IconUsers, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Video Playbacks', value: totalPlays.toLocaleString(), sub: 'Last 30 days', Icon: IconVideo, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
          { label: 'Top Lesson Views', value: topLessons[0]?.totalViews?.toLocaleString() || '—', sub: topLessons[0]?.title?.slice(0,22) || 'N/A', Icon: IconSubscriptions, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        ].map((s,i) => (
          <div key={i} className={`card p-4 border ${s.border}`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
              <s.Icon className="w-4 h-4" />
            </div>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[12px] text-[#6a6f73] mt-0.5 font-medium">{s.label}</p>
            <p className="text-[10px] text-[#9e9e9e] mt-0.5 truncate">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
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
              <p className="section-title">Revenue</p>
              <p className="section-sub">Monthly earnings (USD)</p>
            </div>
            <span className="badge-green font-bold">${totalRev.toLocaleString()} total</span>
          </div>
          <div className="h-52"><Bar data={revenueChart} options={CHART} /></div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-title">Video Playbacks</p>
              <p className="section-sub">Last 14 days</p>
            </div>
            <span className="badge-blue">{totalPlays.toLocaleString()} plays</span>
          </div>
          <div className="h-48"><Line data={playbackChart} options={CHART} /></div>
        </div>

        <div className="card p-5">
          <p className="section-title mb-4">Top Lessons</p>
          <div className="space-y-3">
            {topLessons.slice(0,6).map((lesson, i) => (
              <div key={lesson._id} className="flex items-center gap-3">
                <span className={`text-[11px] font-black w-5 flex-shrink-0 ${i < 3 ? 'text-amber-600' : 'text-[#9e9e9e]'}`}>#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#1c1d1f] truncate">{lesson.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-[#f0ece4] rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100,(lesson.totalViews/(topLessons[0]?.totalViews||1))*100)}%` }}/>
                    </div>
                    <span className="text-[10px] text-[#9e9e9e] flex-shrink-0 flex items-center gap-0.5">
                      <IconVideo className="w-2.5 h-2.5" />{lesson.totalViews?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {topLessons.length === 0 && <p className="text-[12px] text-[#9e9e9e] text-center py-6">No data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}