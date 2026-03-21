import React, { useState } from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const GOLD = '#FFB800';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

const Ring = ({ percent, color, size = 56, sw = 5 }: { percent: number; color: string; size?: number; sw?: number }) => {
  const cx = size / 2, cy = size / 2;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <span style={{ zIndex: 1, color: '#fff', fontSize: 11, fontWeight: 700 }}>{percent}%</span>
    </div>
  );
};

// Day circles for a given week's days
const DayCircles = ({ totalDays, completedDays, currentDay }: { totalDays: number; completedDays: number; currentDay: number }) => (
  <div>
    <p style={{ color: '#555', fontSize: 10, margin: '0 0 8px', textAlign: 'center' }}>tap any day to view</p>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {Array.from({ length: totalDays }).map((_, i) => {
        const done = i < completedDays;
        const current = i === currentDay - 1;
        const bg = done ? PRIMARY : current ? 'rgba(232,81,47,0.15)' : 'rgba(255,255,255,0.06)';
        const border = current ? `2px solid ${PRIMARY}` : '2px solid transparent';
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <span style={{ color: '#555', fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
            <div style={{ width: 34, height: 34, borderRadius: 17, background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {done
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : current
                  ? <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 700 }}>·</span>
                  : null
              }
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default function ClientHome() {
  const totalWeeks = 6;
  const [activeWeek, setActiveWeek] = useState(3);

  // Simulate which weeks have been completed and current state
  const weekData: Record<number, { completedDays: number; totalDays: number; currentDay: number }> = {
    1: { completedDays: 4, totalDays: 4, currentDay: 0 },
    2: { completedDays: 4, totalDays: 4, currentDay: 0 },
    3: { completedDays: 2, totalDays: 4, currentDay: 3 },
    4: { completedDays: 0, totalDays: 4, currentDay: 0 },
    5: { completedDays: 0, totalDays: 4, currentDay: 0 },
    6: { completedDays: 0, totalDays: 4, currentDay: 0 },
  };

  const current = weekData[activeWeek];
  const overallPct = Math.round(((2 * 4 + current.completedDays) / (6 * 4)) * 100);

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

      {/* Active Program Card */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: 20, border: `1px solid ${PRIMARY}44`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, background: `${PRIMARY}18`, pointerEvents: 'none' }} />

          {/* Program header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: SUCCESS }} />
                <span style={{ color: SUCCESS, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>Active</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Strength Block 1</h2>
              <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>Coach: Alex Trainer · {totalWeeks} weeks · 4 days/wk</p>
            </div>
            <Ring percent={overallPct} color={PRIMARY} size={56} sw={5} />
          </div>

          {/* Overall progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#888', fontSize: 11 }}>Week {activeWeek} of {totalWeeks}</span>
              <span style={{ color: PRIMARY, fontSize: 11, fontWeight: 600 }}>{overallPct}% complete</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overallPct}%`, background: `linear-gradient(90deg, ${PRIMARY}, #FF8C42)`, borderRadius: 2 }} />
            </div>
          </div>

          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button
              onClick={() => setActiveWeek(w => Math.max(1, w - 1))}
              style={{ background: 'transparent', border: 'none', color: activeWeek > 1 ? '#888' : '#333', cursor: activeWeek > 1 ? 'pointer' : 'default', padding: 4 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Week {activeWeek}</span>
            <button
              onClick={() => setActiveWeek(w => Math.min(totalWeeks, w + 1))}
              style={{ background: 'transparent', border: 'none', color: activeWeek < totalWeeks ? '#888' : '#333', cursor: activeWeek < totalWeeks ? 'pointer' : 'default', padding: 4 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          {/* Day circles for selected week */}
          <DayCircles
            totalDays={current.totalDays}
            completedDays={current.completedDays}
            currentDay={current.currentDay}
          />

          {/* CTA */}
          {activeWeek === 3 && (
            <button style={{ marginTop: 14, background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 0', width: '100%', cursor: 'pointer' }}>
              Continue — Day 3
            </button>
          )}
          {activeWeek !== 3 && (
            <button style={{ marginTop: 14, background: 'transparent', border: `1px solid ${PRIMARY}`, borderRadius: 10, color: PRIMARY, fontSize: 13, fontWeight: 600, padding: '10px 0', width: '100%', cursor: 'pointer' }}>
              {activeWeek < 3 ? `View Week ${activeWeek}` : `Week ${activeWeek} — Not Started`}
            </button>
          )}
        </div>
      </div>

      {/* Personal Records */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Personal Records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Squat', value: '185', unit: 'kg', badge: '↑ 5kg' },
            { label: 'Deadlift', value: '220', unit: 'kg', badge: '↑ 10kg' },
            { label: 'Bench', value: '120', unit: 'kg', badge: '→ Same' },
          ].map((pr) => (
            <div key={pr.label} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 6px' }}>{pr.label}</p>
              <p style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: GOLD }}>
                {pr.value}<span style={{ fontSize: 10, color: '#888', marginLeft: 2 }}>{pr.unit}</span>
              </p>
              <div style={{ background: pr.badge.includes('↑') ? `${SUCCESS}22` : 'rgba(255,255,255,0.06)', color: pr.badge.includes('↑') ? SUCCESS : '#666', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                {pr.badge}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other Programs */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Previous Programs</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { title: 'Hypertrophy Phase', weeks: 8, days: 5 },
            { title: 'Foundation 101', weeks: 4, days: 3 },
          ].map((p, i) => (
            <div key={i} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.title}</h3>
                <p style={{ color: '#666', fontSize: 11, margin: '3px 0 0' }}>{p.weeks}W · {p.days}D/wk</p>
              </div>
              <span style={{ color: '#555', fontSize: 11, fontWeight: 600 }}>Completed</span>
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
