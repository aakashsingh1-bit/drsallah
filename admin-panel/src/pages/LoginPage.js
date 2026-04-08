import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { IconArrowRight, IconEye, IconEyeOff, IconCheckCircle, IconBook, IconSecurity, IconZap } from '../components/Icons';

const SLIDES = [
  {
    tag: 'Course Management',
    headline: 'Everything you need to run a world-class academy',
    body: 'Create courses, upload HD videos directly to S3, organize modules and track every student — all from one dashboard.',
    features: ['Course & module hierarchy with drag-and-drop ordering', 'Direct AWS S3 video upload with progress tracking', 'Drip content scheduling and access control'],
    stat1: { n: '12,400+', l: 'Active Students' },
    stat2: { n: '3,200+',  l: 'Video Lessons' },
    Icon: IconBook,
    accent: '#f97316',
  },
  {
    tag: 'Advanced Security',
    headline: 'Enterprise protection for your valuable content',
    body: 'Device binding, AI anti-piracy detection, real-time threat monitoring and instant account suspension — security first.',
    features: ['One account — one device binding enforcement', 'AI-powered screen recording and piracy detection', 'Real-time security alerts and automated responses'],
    stat1: { n: '99.9%',  l: 'Threats Blocked' },
    stat2: { n: '< 1ms', l: 'Alert Response' },
    Icon: IconSecurity,
    accent: '#10b981',
  },
  {
    tag: 'Revenue & Analytics',
    headline: 'Grow your revenue with powerful insights',
    body: 'Track subscriptions, monitor revenue trends, understand student behavior and send targeted notifications.',
    features: ['Monthly, quarterly and yearly subscription plans', 'Revenue analytics with per-plan breakdowns', 'Broadcast push notifications to all students'],
    stat1: { n: '$1M+',  l: 'Revenue Tracked' },
    stat2: { n: '99.99%', l: 'Platform Uptime' },
    Icon: IconZap,
    accent: '#6366f1',
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

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!password) return toast.error('Please enter your password');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const S = SLIDES[slide];

  return (
    <div className="min-h-screen flex bg-white">

      {/* ══════════ LEFT — Dark panel with carousel ══════════════════════════ */}
      <div className="hidden lg:flex lg:w-[55%] login-left flex-col relative overflow-hidden">

        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />

        {/* Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full blur-[120px] opacity-10 transition-all duration-1000"
          style={{ background: S.accent }}
        />

        {/* Inner content */}
        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-xl shadow-brand-500/30">
              <span className="text-white font-black text-sm">DS</span>
            </div>
            <div>
              <p className="text-white font-bold text-base leading-none">Dr. Sallah</p>
              <p className="text-white/40 text-[11px] mt-0.5 font-medium">Education Platform</p>
            </div>
          </div>

          {/* Slide area */}
          <div className="flex-1 flex flex-col justify-center max-w-[420px] space-y-7">

            {/* Tag */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold w-fit border"
              style={{ color: S.accent, borderColor: `${S.accent}30`, background: `${S.accent}12` }}
            >
              <S.Icon className="w-3.5 h-3.5" />
              {S.tag}
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-[34px] font-black text-white leading-[1.18] tracking-tight">
                {S.headline}
              </h1>
              <p className="text-white/50 text-[15px] leading-relaxed">{S.body}</p>
            </div>

            {/* Feature list */}
            <ul className="space-y-3">
              {S.features.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${S.accent}20` }}
                  >
                    <IconCheckCircle className="w-3 h-3" style={{ color: S.accent }} />
                  </div>
                  <span className="text-white/55 text-[13px] leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[S.stat1, S.stat2].map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3.5 border"
                  style={{ borderColor: `${S.accent}25`, background: `${S.accent}0a` }}
                >
                  <p className="text-2xl font-black text-white leading-none" style={{ color: S.accent }}>{s.n}</p>
                  <p className="text-white/40 text-[11px] mt-1.5 font-medium">{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Carousel controls */}
          <div className="flex items-center gap-2.5">
            {SLIDES.map((sl, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === slide ? 28 : 6,
                  height: 6,
                  background: i === slide ? S.accent : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
            <span className="text-white/20 text-[11px] ml-1">{slide + 1} / {SLIDES.length}</span>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT — Login form ════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#faf9f6]">
        <div className="w-full max-w-[400px] animate-fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-11 h-11 rounded-xl bg-brand-500 flex items-center justify-center shadow-xl shadow-brand-500/30">
              <span className="text-white font-black text-sm">DS</span>
            </div>
            <div>
              <p className="font-bold text-[#1c1d1f] text-lg">Dr. Sallah</p>
              <p className="text-[11px] text-[#9e9e9e]">Admin Portal</p>
            </div>
          </div>

          {/* Header */}
          <div className="mb-7">
            <p className="text-[11px] font-bold text-brand-600 uppercase tracking-widest mb-2">Admin Portal</p>
            <h2 className="text-[28px] font-black text-[#1c1d1f] leading-tight tracking-tight">Sign in to continue</h2>
            <p className="text-[#9e9e9e] text-[13px] mt-1.5">Enter your credentials to access the dashboard</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl border border-[#e8e6e0] shadow-card-md p-7 space-y-5">

            {/* Email */}
            <div>
              <label className="field-label">Email address</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#b0afab]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </span>
                <input
                  type="email"
                  className="field-input pl-10"
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
              <label className="field-label">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#b0afab]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="field-input pl-10 pr-11"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b0afab] hover:text-[#6a6f73] transition-colors"
                >
                  {showPass ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              className="btn-primary w-full py-3 text-[14px] rounded-xl mt-1"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In to Dashboard
                  <IconArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>

          {/* Demo credentials */}
          <div className="mt-4 p-4 rounded-xl bg-brand-50 border border-brand-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-brand-700 uppercase tracking-widest mb-2">Demo Credentials</p>
                <p className="text-[12px] text-brand-800 font-mono">admin@drsallah.com</p>
                <p className="text-[12px] text-brand-800 font-mono mt-0.5">Admin@12345</p>
              </div>
              <button
                type="button"
                onClick={() => { setEmail('admin@drsallah.com'); setPassword('Admin@12345'); }}
                className="text-[11px] font-bold bg-white text-brand-600 hover:bg-brand-600 hover:text-white px-3 py-2 rounded-lg transition-all border border-brand-200 hover:border-transparent shadow-sm mt-1 flex-shrink-0"
              >
                Use demo
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-[#b0afab] mt-7">
            &copy; {new Date().getFullYear()} Dr. Sallah Education Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
