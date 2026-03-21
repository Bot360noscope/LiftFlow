import React, { useState } from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const GOLD = '#FFB800';

const DARK = {
  bg: 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)',
  text: '#fff', textMuted: '#888', textDim: '#555',
  cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.09)',
  tabBar: 'rgba(15,15,15,0.96)', tabBarBorder: 'rgba(255,255,255,0.08)',
  toggleBg: 'rgba(255,255,255,0.08)', surface: 'rgba(255,255,255,0.06)',
  dayUpcoming: 'rgba(255,255,255,0.05)', dayUpcomingBorder: 'rgba(255,255,255,0.12)',
  progressTrack: 'rgba(255,255,255,0.08)',
};
const LIGHT = {
  bg: '#F2F2F7',
  text: '#1C1C1E', textMuted: '#6C6C70', textDim: '#AEAEB2',
  cardBg: '#FFFFFF', cardBorder: 'rgba(0,0,0,0.08)',
  tabBar: 'rgba(248,248,248,0.97)', tabBarBorder: 'rgba(0,0,0,0.1)',
  toggleBg: 'rgba(0,0,0,0.06)', surface: 'rgba(0,0,0,0.04)',
  dayUpcoming: 'rgba(0,0,0,0.04)', dayUpcomingBorder: 'rgba(0,0,0,0.12)',
  progressTrack: 'rgba(0,0,0,0.08)',
};

// Same LiftFlow badge across all tab screens
const LiftFlowBadge = () => (
  <div style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}44`, borderRadius: 99, padding: '4px 10px' }}>
    <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 800, letterSpacing: -0.3 }}>LiftFlow</span>
  </div>
);

const Ring = ({ percent, color, size = 56, sw = 5, textColor = '#fff' }: { percent: number; color: string; size?: number; sw?: number; textColor?: string }) => {
  const cx = size / 2, cy = size / 2, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r, offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ color: textColor, fontSize: 11, fontWeight: 700 }}>{percent}%</span>
      </div>
    </div>
  );
};

const DayCircles = ({ totalDays, completedDays, currentDay, t }: { totalDays: number; completedDays: number; currentDay: number; t: typeof DARK }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    {Array.from({ length: totalDays }).map((_, i) => {
      const done = i < completedDays;
      const current = i === currentDay - 1;
      const upcoming = !done && !current;
      const bg = done ? PRIMARY : current ? `${PRIMARY}20` : t.dayUpcoming;
      const border = current ? `2px solid ${PRIMARY}` : done ? '2px solid transparent' : `2px solid ${t.dayUpcomingBorder}`;
      return (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ color: upcoming ? t.textDim : t.textMuted, fontSize: 10, fontWeight: 600 }}>Day {i + 1}</span>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {done
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : current ? <div style={{ width: 8, height: 8, borderRadius: 4, background: PRIMARY }} /> : null
            }
          </div>
        </div>
      );
    })}
  </div>
);

export default function ClientHome() {
  const [dark, setDark] = useState(true);
  const [activeWeek, setActiveWeek] = useState(3);
  const t = dark ? DARK : LIGHT;

  const totalWeeks = 6;
  const weekData: Record<number, { completedDays: number; totalDays: number; currentDay: number }> = {
    1: { completedDays: 4, totalDays: 4, currentDay: 0 },
    2: { completedDays: 4, totalDays: 4, currentDay: 0 },
    3: { completedDays: 2, totalDays: 4, currentDay: 3 },
    4: { completedDays: 0, totalDays: 4, currentDay: 0 },
    5: { completedDays: 0, totalDays: 4, currentDay: 0 },
    6: { completedDays: 0, totalDays: 4, currentDay: 0 },
  };
  const current = weekData[activeWeek];
  const isCurrentWeek = activeWeek === 3;
  // Ring = current week completion
  const weekPct = Math.round((current.completedDays / current.totalDays) * 100);

  const card: React.CSSProperties = {
    background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
    backdropFilter: dark ? 'blur(12px)' : undefined,
    boxShadow: dark ? undefined : '0 1px 4px rgba(0,0,0,0.07)',
  };

  return (
    <div style={{ width: 390, minHeight: '100vh', background: t.bg, color: t.text, fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, transition: 'background 0.3s' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div>
            <p style={{ color: t.textMuted, fontSize: 13, margin: '0 0 2px' }}>Welcome back</p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: t.text }}>Jordan M.</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LiftFlowBadge />
            <button onClick={() => setDark(!dark)} style={{ background: t.toggleBg, border: 'none', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* Active Program Card */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: 20, border: `1px solid ${PRIMARY}44`, position: 'relative', overflow: 'hidden', boxShadow: dark ? undefined : '0 2px 8px rgba(232,81,47,0.08)' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 140, height: 140, borderRadius: 70, background: `${PRIMARY}10`, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: 4, background: SUCCESS }} />
                <span style={{ color: SUCCESS, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7 }}>Active</span>
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: t.text }}>Strength Block 1</h2>
              <p style={{ color: t.textMuted, fontSize: 12, margin: 0 }}>Coach: Alex T. · {totalWeeks} weeks · 4 days/wk</p>
            </div>
            {/* Ring = this week's completion */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Ring percent={weekPct} color={PRIMARY} size={62} sw={5} textColor={t.text} />
              <span style={{ color: t.textDim, fontSize: 10 }}>this week</span>
            </div>
          </div>

          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => setActiveWeek(w => Math.max(1, w - 1))} disabled={activeWeek === 1}
              style={{ background: 'transparent', border: 'none', color: activeWeek > 1 ? t.textMuted : t.textDim, cursor: activeWeek > 1 ? 'pointer' : 'default', padding: '4px 6px', lineHeight: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Week {activeWeek}</span>
              <span style={{ color: t.textDim, fontSize: 13 }}> / {totalWeeks}</span>
              {isCurrentWeek && <div style={{ color: PRIMARY, fontSize: 10, fontWeight: 600, marginTop: 1 }}>current</div>}
              {activeWeek < 3 && <div style={{ color: SUCCESS, fontSize: 10, fontWeight: 600, marginTop: 1 }}>completed</div>}
              {activeWeek > 3 && <div style={{ color: t.textDim, fontSize: 10, marginTop: 1 }}>upcoming</div>}
            </div>
            <button onClick={() => setActiveWeek(w => Math.min(totalWeeks, w + 1))} disabled={activeWeek === totalWeeks}
              style={{ background: 'transparent', border: 'none', color: activeWeek < totalWeeks ? t.textMuted : t.textDim, cursor: activeWeek < totalWeeks ? 'pointer' : 'default', padding: '4px 6px', lineHeight: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <DayCircles totalDays={current.totalDays} completedDays={current.completedDays} currentDay={current.currentDay} t={t} />

          <div style={{ marginTop: 16 }}>
            {isCurrentWeek
              ? <button style={{ background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 0', width: '100%', cursor: 'pointer' }}>Continue — Day 3</button>
              : activeWeek < 3
                ? <button style={{ background: 'transparent', border: `1px solid ${t.cardBorder}`, borderRadius: 10, color: t.textMuted, fontSize: 13, fontWeight: 600, padding: '10px 0', width: '100%', cursor: 'pointer' }}>View Week {activeWeek}</button>
                : <button style={{ background: 'transparent', border: `1px solid ${t.dayUpcomingBorder}`, borderRadius: 10, color: t.textDim, fontSize: 13, fontWeight: 600, padding: '10px 0', width: '100%', cursor: 'default' }}>Locked</button>
            }
          </div>
        </div>
      </div>

      {/* Personal Records */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0, color: t.text }}>Personal Records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Squat', value: '185', unit: 'kg' },
            { label: 'Deadlift', value: '220', unit: 'kg' },
            { label: 'Bench', value: '120', unit: 'kg' },
          ].map((pr) => (
            <div key={pr.label} style={{ ...card, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ color: t.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px' }}>{pr.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: GOLD, lineHeight: 1 }}>{pr.value}</p>
              <p style={{ fontSize: 10, color: t.textDim, margin: '3px 0 0' }}>{pr.unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Previous Programs */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0, color: t.text }}>Previous Programs</h2>
        {[{ title: 'Hypertrophy Phase', weeks: 8, days: 5 }, { title: 'Foundation 101', weeks: 4, days: 3 }].map((p, i) => (
          <div key={i} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{p.title}</h3>
              <p style={{ color: t.textMuted, fontSize: 11, margin: '3px 0 0' }}>{p.weeks}W · {p.days}D/wk</p>
            </div>
            <span style={{ color: t.textDim, fontSize: 11, fontWeight: 600 }}>Completed</span>
          </div>
        ))}
      </div>

      {/* Tab Bar — 3 tabs for clients */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: t.tabBar, borderTop: `1px solid ${t.tabBarBorder}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(20px)', zIndex: 50 }}>
        {[
          { label: 'Home', active: true, path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/> },
          { label: 'Messages', active: false, path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
          { label: 'Profile', active: false, path: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
        ].map((tab, i) => (
          <div key={i} style={{ color: tab.active ? PRIMARY : t.textDim, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.path}</svg>
            <span style={{ fontSize: 9, fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
