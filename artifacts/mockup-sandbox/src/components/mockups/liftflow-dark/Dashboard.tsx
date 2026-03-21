import React, { useState } from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const WARNING = '#FF9500';

const DARK = {
  bg: 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)',
  text: '#fff', textMuted: '#888', textDim: '#555',
  cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.09)',
  tabBar: 'rgba(15,15,15,0.96)', tabBarBorder: 'rgba(255,255,255,0.08)',
  toggleBg: 'rgba(255,255,255,0.08)',
};
const LIGHT = {
  bg: '#F2F2F7',
  text: '#1C1C1E', textMuted: '#6C6C70', textDim: '#AEAEB2',
  cardBg: '#FFFFFF', cardBorder: 'rgba(0,0,0,0.08)',
  tabBar: 'rgba(248,248,248,0.97)', tabBarBorder: 'rgba(0,0,0,0.1)',
  toggleBg: 'rgba(0,0,0,0.06)',
};

const Ring = ({ percent, color, size = 100, strokeWidth = 8, label = '', subLabel = '', textColor = '#fff' }: {
  percent: number; color: string; size?: number; strokeWidth?: number; label?: string; subLabel?: string; textColor?: string;
}) => {
  const cx = size / 2, cy = size / 2, r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {label && <span style={{ color: textColor, fontWeight: 700, fontSize: size * 0.22, lineHeight: 1 }}>{label}</span>}
        {subLabel && <span style={{ color: '#888', fontSize: 9, marginTop: 2 }}>{subLabel}</span>}
      </div>
    </div>
  );
};

// Shared LiftFlow header badge — same across all screens
const LiftFlowBadge = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {/* Plan badge */}
    <div style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.35)', borderRadius: 99, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10 }}>⭐</span>
      <span style={{ color: '#FFD700', fontSize: 10, fontWeight: 700 }}>Growth</span>
    </div>
    {/* LiftFlow wordmark pill */}
    <div style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}44`, borderRadius: 99, padding: '4px 10px' }}>
      <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 800, letterSpacing: -0.3 }}>LiftFlow</span>
    </div>
  </div>
);

export default function Dashboard() {
  const [dark, setDark] = useState(true);
  const t = dark ? DARK : LIGHT;

  const card: React.CSSProperties = {
    background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
    backdropFilter: dark ? 'blur(12px)' : undefined,
    boxShadow: dark ? undefined : '0 1px 4px rgba(0,0,0,0.07)',
  };

  return (
    <div style={{ width: 390, minHeight: '100vh', background: t.bg, color: t.text, fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, position: 'relative', transition: 'background 0.3s' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>Good morning, Alex</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LiftFlowBadge />
            {/* Theme toggle */}
            <button onClick={() => setDark(!dark)} style={{ background: t.toggleBg, border: 'none', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: t.text }}>Monday, March 21</h1>
      </div>

      {/* Stats Grid — rings row */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Ring percent={68} color={PRIMARY} size={96} strokeWidth={8} label="68%" subLabel="adherence" textColor={t.text} />
          <p style={{ color: t.textMuted, fontSize: 11, margin: '10px 0 0', textAlign: 'center' }}>Weekly Adherence</p>
        </div>
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Ring percent={(9 / 12) * 100} color={SUCCESS} size={96} strokeWidth={8} label="9/12" subLabel="clients" textColor={t.text} />
          <p style={{ color: t.textMuted, fontSize: 11, margin: '10px 0 0', textAlign: 'center' }}>On Track</p>
          <p style={{ color: t.textDim, fontSize: 10, margin: '2px 0 0', textAlign: 'center' }}>≥70% adherence</p>
        </div>
      </div>

      {/* Pending Reviews — full width */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: 16, border: `1px solid ${WARNING}33` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: `${WARNING}22`, color: WARNING, padding: 8, borderRadius: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: t.text }}>Pending Reviews</p>
                <p style={{ margin: 0, color: WARNING, fontSize: 11, fontWeight: 600 }}>47 videos awaiting feedback</p>
              </div>
            </div>
            <div style={{ color: t.textDim }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
          {[
            { name: 'Jordan M', exercise: 'Back Squat', time: '2h ago' },
            { name: 'Casey R', exercise: 'Romanian Deadlift', time: '5h ago' },
            { name: 'Taylor B', exercise: 'Bench Press', time: 'Yesterday' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${t.cardBorder}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: `${PRIMARY}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                  {r.name[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: t.text }}>{r.name}</p>
                  <p style={{ margin: 0, color: t.textMuted, fontSize: 11 }}>{r.exercise}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: t.textDim, fontSize: 11 }}>{r.time}</span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${WARNING}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WARNING }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.cardBorder}`, textAlign: 'center' }}>
            <span style={{ color: WARNING, fontSize: 12, fontWeight: 600 }}>View all 47 →</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: t.tabBar, borderTop: `1px solid ${t.tabBarBorder}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(20px)', zIndex: 50 }}>
        {[
          { path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, active: true },
          { path: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>, active: false },
          { path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, active: false },
          { path: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>, active: false },
        ].map((tab, i) => (
          <div key={i} style={{ color: tab.active ? PRIMARY : t.textDim }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.path}</svg>
          </div>
        ))}
      </div>
    </div>
  );
}
