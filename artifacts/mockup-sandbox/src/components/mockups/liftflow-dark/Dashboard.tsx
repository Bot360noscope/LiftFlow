import React from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const WARNING = '#FF9500';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const Ring = ({ percent, color, size = 100, strokeWidth = 8, label = '', subLabel = '' }: {
  percent: number; color: string; size?: number; strokeWidth?: number; label?: string; subLabel?: string;
}) => {
  const cx = size / 2, cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {label && <span style={{ color: '#fff', fontWeight: 700, fontSize: size * 0.22, lineHeight: 1 }}>{label}</span>}
        {subLabel && <span style={{ color: '#888', fontSize: 9, marginTop: 2 }}>{subLabel}</span>}
      </div>
    </div>
  );
};

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

export default function Dashboard() {
  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Good morning, Alex</p>
          <p style={{ color: PRIMARY, fontWeight: 800, fontSize: 15, margin: 0, letterSpacing: -0.5 }}>LiftFlow</p>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Monday, March 21</h1>
      </div>

      {/* Stats Grid — rings row */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Ring percent={68} color={PRIMARY} size={96} strokeWidth={8} label="68%" subLabel="adherence" />
          <p style={{ color: '#888', fontSize: 11, margin: '10px 0 0', textAlign: 'center' }}>Weekly Adherence</p>
        </div>
        <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Ring percent={(9 / 12) * 100} color={SUCCESS} size={96} strokeWidth={8} label="9/12" subLabel="clients" />
          <p style={{ color: '#888', fontSize: 11, margin: '10px 0 0', textAlign: 'center' }}>On Track</p>
          <p style={{ color: '#555', fontSize: 10, margin: '2px 0 0', textAlign: 'center' }}>≥70% adherence</p>
        </div>
      </div>

      {/* Pending Reviews — full width, tappable, shows preview */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: 16, border: `1px solid ${WARNING}33` }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: `${WARNING}22`, color: WARNING, padding: 8, borderRadius: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                  <circle cx="12" cy="13" r="3"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>Pending Reviews</p>
                <p style={{ margin: 0, color: WARNING, fontSize: 11, fontWeight: 600 }}>47 videos awaiting feedback</p>
              </div>
            </div>
            <div style={{ color: '#555' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
          {/* Preview rows — tapping the card opens the full review queue */}
          {[
            { name: 'Jordan M', exercise: 'Back Squat', time: '2h ago' },
            { name: 'Casey R', exercise: 'Romanian Deadlift', time: '5h ago' },
            { name: 'Taylor B', exercise: 'Bench Press', time: 'Yesterday' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: `${PRIMARY}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                  {r.name[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{r.name}</p>
                  <p style={{ margin: 0, color: '#666', fontSize: 11 }}>{r.exercise}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#555', fontSize: 11 }}>{r.time}</span>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${WARNING}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WARNING }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <span style={{ color: WARNING, fontSize: 12, fontWeight: 600 }}>View all 47 →</span>
          </div>
        </div>
      </div>

      {/* Client Overview */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Client Overview</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { initial: 'J', name: 'Jordan M', program: 'Strength Block 1', time: '2h ago', pct: 84, status: SUCCESS },
            { initial: 'C', name: 'Casey R', program: 'Hypertrophy 6W', time: 'Yesterday', pct: 52, status: WARNING },
            { initial: 'T', name: 'Taylor B', program: 'Fat Loss Phase', time: '3d ago', pct: 23, status: '#FF3B30' },
          ].map((c) => (
            <div key={c.name} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${c.status}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', fontSize: 17, fontWeight: 700 }}>
                  {c.initial}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: c.status }} />
                  </div>
                  <p style={{ color: '#666', fontSize: 11, margin: '2px 0 0' }}>{c.program}</p>
                  <p style={{ color: '#555', fontSize: 10, margin: '1px 0 0' }}>{c.time}</p>
                </div>
              </div>
              <Ring percent={c.pct} color={c.status} size={38} strokeWidth={4} label={`${c.pct}%`} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <button style={{ background: 'transparent', border: `1px solid ${PRIMARY}`, borderRadius: 10, color: PRIMARY, fontSize: 13, fontWeight: 600, padding: '10px 0', width: '100%', cursor: 'pointer' }}>
            View All Clients
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: 'rgba(15,15,15,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(16px)', zIndex: 50 }}>
        {[
          { path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, active: true },
          { path: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>, active: false },
          { path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>, active: false },
          { path: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>, active: false },
        ].map((tab, i) => (
          <div key={i} style={{ color: tab.active ? PRIMARY : '#555' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.path}</svg>
          </div>
        ))}
      </div>
    </div>
  );
}
