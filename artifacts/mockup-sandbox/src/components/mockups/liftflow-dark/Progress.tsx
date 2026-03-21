import React from 'react';

const PRIMARY = '#E8512F';
const PRIMARY_MID = '#FF8C42';
const PRIMARY_LIGHT = '#FFAB6E';
const SUCCESS = '#34C759';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

export default function Progress() {
  const percent = 72;
  const size = 148;
  const strokeWidth = 12;
  const cx = size / 2, cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  // Program has 5 days — client is on Day 4
  const days = [
    { label: 'Day 1', done: true },
    { label: 'Day 2', done: true },
    { label: 'Day 3', done: true },
    { label: 'Day 4', done: false, current: true },
    { label: 'Day 5', done: false },
  ];

  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Progress</h1>
        <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>Strength Block 1 — Week 2</p>
      </div>

      {/* Big Ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={PRIMARY} />
                <stop offset="100%" stopColor={PRIMARY_MID} />
              </linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={strokeWidth}
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
          </svg>
          <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>72%</span>
            <span style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Complete</span>
          </div>
        </div>
      </div>

      {/* Day circles */}
      <div style={{ padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        {days.map((d, i) => {
          const bg = d.done ? PRIMARY : d.current ? 'rgba(232,81,47,0.15)' : 'rgba(255,255,255,0.06)';
          const numColor = d.done ? '#fff' : d.current ? PRIMARY : '#555';
          const border = d.current ? `2px solid ${PRIMARY}` : '2px solid transparent';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#555', fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
              <div style={{ width: 34, height: 34, borderRadius: 17, background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {d.done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={{ color: numColor, fontSize: 13, fontWeight: 700 }}>{d.current ? '·' : ''}</span>
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Personal Records */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Personal Records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Squat', value: '185', unit: 'kg', badge: '↑ 5kg', color: PRIMARY },
            { label: 'Deadlift', value: '220', unit: 'kg', badge: '↑ 10kg', color: PRIMARY_MID },
            { label: 'Bench', value: '120', unit: 'kg', badge: '→ Same', color: PRIMARY_LIGHT },
          ].map((pr) => (
            <div key={pr.label} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px' }}>{pr.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: pr.color }}>
                {pr.value}<span style={{ fontSize: 10, color: '#888', marginLeft: 2 }}>{pr.unit}</span>
              </p>
              <div style={{ background: `${pr.color}22`, color: pr.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                {pr.badge}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 16px' }}>
        <button style={{ background: 'transparent', border: `1px solid ${PRIMARY}`, borderRadius: 10, color: PRIMARY, fontSize: 13, fontWeight: 600, padding: '10px 0', width: '100%', cursor: 'pointer' }}>
          Continue — Day 4
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: 'rgba(15,15,15,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(16px)', zIndex: 50 }}>
        {[
          { path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, active: false },
          { path: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>, active: true },
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
