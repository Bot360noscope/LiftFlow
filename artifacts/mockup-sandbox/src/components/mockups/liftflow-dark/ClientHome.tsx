import React from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const WARNING = '#FF9500';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

const Ring = ({ percent, color, size = 60, strokeWidth = 5 }: { percent: number; color: string; size?: number; strokeWidth?: number }) => {
  const cx = size / 2, cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <span style={{ zIndex: 1, color: '#fff', fontSize: 11, fontWeight: 700 }}>{percent}%</span>
    </div>
  );
};

export default function ClientHome() {
  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
          <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Welcome back, Jordan</p>
          <p style={{ color: PRIMARY, fontWeight: 800, fontSize: 15, margin: 0 }}>LiftFlow</p>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Your Programs</h1>
      </div>

      {/* Active Program Card — hero style */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: 20, border: `1px solid ${PRIMARY}44`, position: 'relative', overflow: 'hidden' }}>
          {/* Subtle glow */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, background: `${PRIMARY}18`, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: SUCCESS }} />
                <span style={{ color: SUCCESS, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Active</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Strength Block 1</h2>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>Coach: Alex Trainer · 6 weeks · 4 days/wk</p>
            </div>
            <Ring percent={45} color={PRIMARY} size={56} strokeWidth={5} />
          </div>

          {/* Week progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#888', fontSize: 11 }}>Week 3 of 6</span>
              <span style={{ color: PRIMARY, fontSize: 11, fontWeight: 600 }}>45% complete</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '45%', background: `linear-gradient(90deg, ${PRIMARY}, #FF8C42)`, borderRadius: 2 }} />
            </div>
          </div>

          {/* Day circles for current week */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            {[
              { done: true },
              { done: true },
              { done: false, current: true },
              { done: false },
            ].map((d, i) => {
              const bg = d.done ? PRIMARY : d.current ? 'rgba(232,81,47,0.15)' : 'rgba(255,255,255,0.06)';
              const border = d.current ? `2px solid ${PRIMARY}` : '2px solid transparent';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: '#555', fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
                  <div style={{ width: 34, height: 34, borderRadius: 17, background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {d.done
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : d.current
                        ? <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 700 }}>·</span>
                        : null
                    }
                  </div>
                </div>
              );
            })}
          </div>

          <button style={{ background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 0', width: '100%', cursor: 'pointer', letterSpacing: 0.3 }}>
            Start Day 3
          </button>
        </div>
      </div>

      {/* Other Programs */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Other Programs</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { title: 'Hypertrophy Phase', coach: 'Alex Trainer', weeks: 8, days: 5, pct: 100, status: '#888', statusLabel: 'Completed' },
            { title: 'Foundation 101', coach: 'Alex Trainer', weeks: 4, days: 3, pct: 100, status: '#888', statusLabel: 'Completed' },
          ].map((p, i) => (
            <div key={i} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.title}</h3>
                <p style={{ color: '#666', fontSize: 11, margin: '3px 0 0' }}>{p.weeks}W · {p.days}D/wk · {p.coach}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: p.status, fontSize: 11, fontWeight: 600 }}>{p.statusLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: 'rgba(15,15,15,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(16px)', zIndex: 50 }}>
        {[
          { path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, active: true },
          { path: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>, active: false },
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
