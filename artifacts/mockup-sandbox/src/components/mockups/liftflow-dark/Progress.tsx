import React from 'react';

const PRIMARY = '#E8512F';
const PRIMARY_LIGHT = '#FF8C42';
const SUCCESS = '#34C759';
const WARNING = '#FF9500';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

const outlineBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${PRIMARY}`,
  borderRadius: 10,
  color: PRIMARY,
  fontSize: 13,
  fontWeight: 600,
  padding: '10px 0',
  width: '100%',
  cursor: 'pointer',
  letterSpacing: 0.3,
};

export default function Progress() {
  const percent = 72;
  const size = 148;
  const strokeWidth = 12;
  const cx = size / 2, cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', overflowY: 'auto', paddingBottom: 80, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Progress</h1>
        <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>This Week</p>
      </div>

      {/* Big Ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={PRIMARY} />
                <stop offset="100%" stopColor={PRIMARY_LIGHT} />
              </linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={strokeWidth}
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform={`rotate(-90, ${cx}, ${cy})`} />
          </svg>
          <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>72%</span>
            <span style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Complete</span>
          </div>
        </div>
      </div>

      {/* Day Pills */}
      <div style={{ padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
          let bg = 'rgba(255,255,255,0.06)';
          let color = '#555';
          let content = '';
          if (i < 4) { bg = PRIMARY; color = '#fff'; content = '✓'; }
          else if (i === 4) { bg = WARNING; color = '#fff'; content = '−'; }
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#666', fontSize: 11 }}>{day}</span>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color }}>
                {content}
              </div>
            </div>
          );
        })}
      </div>

      {/* PR Cards */}
      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Personal Records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Best Squat', value: '185', unit: 'kg', badge: '↑ 5kg', badgeColor: SUCCESS, color: '#FF4444' },
            { label: 'Best Deadlift', value: '220', unit: 'kg', badge: '↑ 10kg', badgeColor: SUCCESS, color: '#4488FF' },
            { label: 'Best Bench', value: '120', unit: 'kg', badge: '→ Same', badgeColor: '#555', color: '#44CC44' },
          ].map((pr) => (
            <div key={pr.label} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px' }}>{pr.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: pr.color }}>{pr.value}<span style={{ fontSize: 10, color: '#888', marginLeft: 2 }}>{pr.unit}</span></p>
              <div style={{ background: `${pr.badgeColor}22`, color: pr.badgeColor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{pr.badge}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Streak Row */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ color: WARNING, fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>14 Day</p>
            <p style={{ color: '#888', fontSize: 11, margin: 0 }}>Streak 🔥</p>
          </div>
          <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>32</p>
            <p style={{ color: '#888', fontSize: 11, margin: 0 }}>Sessions</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: PRIMARY, fontSize: 15, fontWeight: 800, margin: '0 0 2px' }}>4.2h</p>
            <p style={{ color: '#888', fontSize: 11, margin: 0 }}>Avg/Week</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Recent Activity</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { title: 'Upper Body A', date: 'Mon Mar 18', details: '8 exercises · 58 min' },
            { title: 'Lower Body B', date: 'Tue Mar 19', details: '6 exercises · 45 min' },
            { title: 'Push Day', date: 'Wed Mar 20', details: '7 exercises · 51 min' },
          ].map((a, i) => (
            <div key={i} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>{a.title}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: PRIMARY, fontSize: 11, fontWeight: 600 }}>{a.date}</span>
                  <span style={{ color: '#444', fontSize: 11 }}>•</span>
                  <span style={{ color: '#888', fontSize: 11 }}>{a.details}</span>
                </div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: `${SUCCESS}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUCCESS, flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          ))}
        </div>

        {/* Hollow CTA button */}
        <div style={{ marginTop: 14 }}>
          <button style={outlineBtn}>Log Workout</button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: 'rgba(15,15,15,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(16px)', zIndex: 50 }}>
        {[
          { icon: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, active: false },
          { icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>, active: true },
          { icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, active: false },
          { icon: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>, active: false },
        ].map((tab, i) => (
          <div key={i} style={{ color: tab.active ? PRIMARY : '#555' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.icon}</svg>
          </div>
        ))}
      </div>
    </div>
  );
}
