import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const SLIDES = [
  {
    title: 'Empower Education',
    sub: 'Manage courses, students, and content from one powerful dashboard.',
    gradient: 'from-violet-900/80 via-purple-900/60 to-indigo-900/80',
    accent: '#8b5cf6',
    icon: '🎓',
    stat1: { label: 'Active Students', value: '12,400+' },
    stat2: { label: 'Video Lessons', value: '3,200+' },
  },
  {
    title: 'Complete Content Control',
    sub: 'Upload videos directly to AWS S3, organize modules, set drip schedules.',
    gradient: 'from-blue-900/80 via-cyan-900/60 to-teal-900/80',
    accent: '#06b6d4',
    icon: '📹',
    stat1: { label: 'Courses Published', value: '480+' },
    stat2: { label: 'Hours of Content', value: '1,800+' },
  },
  {
    title: 'Advanced Security',
    sub: 'Device binding, anti-piracy AI, DRM protection, and real-time threat alerts.',
    gradient: 'from-rose-900/80 via-pink-900/60 to-fuchsia-900/80',
    accent: '#f43f5e',
    icon: '🛡️',
    stat1: { label: 'Threats Blocked', value: '99.9%' },
    stat2: { label: 'Uptime', value: '99.99%' },
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('admin@drsallah.com');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  // Auto-advance carousel
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return toast.error('Password is required');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back, Admin!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const current = SLIDES[slide];

  return (
    <div className="min-h-screen flex bg-[#0d0d14]">

      {/* ── Left Panel: Carousel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Background gradient layers */}
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 bg-gradient-to-br ${s.gradient} transition-opacity duration-1000 ${i === slide ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}

        {/* Subtle pattern */}
        <div className="absolute inset-0 bg-hero-pattern opacity-40" />

        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ background: current.accent }} />
        <div className="absolute bottom-20 right-20 w-60 h-60 rounded-full blur-3xl opacity-15" style={{ background: current.accent }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xl" style={{ background: `linear-gradient(135deg, ${current.accent}, #7c3aed)` }}>
              DS
            </div>
            <div>
              <p className="font-bold text-white text-base leading-none">Dr. Sallah</p>
              <p className="text-xs text-white/50 mt-0.5">Education Platform</p>
            </div>
          </div>

          {/* Slide Content */}
          <div className="space-y-8">
            <div className="text-8xl">{current.icon}</div>
            <div>
              <h1 className="text-4xl font-black text-white leading-tight mb-3">{current.title}</h1>
              <p className="text-white/60 text-lg leading-relaxed max-w-md">{current.sub}</p>
            </div>

            {/* Stats */}
            <div className="flex gap-6">
              {[current.stat1, current.stat2].map((s, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl px-5 py-4">
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-sm text-white/50 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Carousel dots */}
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`transition-all duration-300 rounded-full ${i === slide ? 'w-8 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Form ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-in">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-black text-lg shadow-xl shadow-violet-500/30">DS</div>
            <div>
              <p className="font-bold text-white text-lg leading-none">Dr. Sallah</p>
              <p className="text-xs text-gray-500">Education Platform</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-white">Welcome back</h2>
            <p className="text-gray-500 mt-1.5">Sign in to your admin panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-base">✉️</span>
                <input
                  type="email"
                  className="input pl-10"
                  placeholder="admin@drsallah.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-base">🔒</span>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pl-10 pr-12"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" className="btn-primary w-full py-3 text-base mt-2" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg>
                </span>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-xs text-gray-500 mb-2 font-semibold">Demo Credentials</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">admin@drsallah.com</p>
                <p className="text-xs text-gray-400">Admin@12345</p>
              </div>
              <button
                type="button"
                onClick={() => { setEmail('admin@drsallah.com'); setPassword('Admin@12345'); }}
                className="text-xs bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 px-3 py-1.5 rounded-lg transition-colors border border-violet-500/20"
              >
                Auto-fill
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 mt-8">
            © {new Date().getFullYear()} Dr. Sallah Education Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
