import React, { useState } from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const GOLD = '#FFB800';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';
const T = { text: '#fff', textMuted: '#888', textDim: '#555', cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.09)' };

const card: React.CSSProperties = { background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, backdropFilter: 'blur(12px)' };

const Ring = ({ percent, size = 58, sw = 5 }: { percent: number; size?: number; sw?: number }) => {
  const cx = size / 2, cy = size / 2, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={PRIMARY} strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={circ - (percent / 100) * circ} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <span style={{ zIndex: 1, color: '#fff', fontSize: 11, fontWeight: 700 }}>{percent}%</span>
    </div>
  );
};

const DayCircle = ({ index, state }: { index: number; state: 'done' | 'current' | 'upcoming' }) => {
  const bg = state === 'done' ? PRIMARY : state === 'current' ? `${PRIMARY}20` : 'rgba(255,255,255,0.05)';
  const border = state === 'current' ? `2px solid ${PRIMARY}` : state === 'upcoming' ? '2px solid rgba(255,255,255,0.12)' : '2px solid transparent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <span style={{ color: state === 'upcoming' ? T.textDim : T.textMuted, fontSize: 10, fontWeight: 600 }}>Day {index + 1}</span>
      <div style={{ width: 36, height: 36, borderRadius: 18, background: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {state === 'done' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        {state === 'current' && <div style={{ width: 8, height: 8, borderRadius: 4, background: PRIMARY }} />}
      </div>
    </div>
  );
};

export default function ClientHome() {
  const [activeWeek, setActiveWeek] = useState(3);
  const totalWeeks = 6;
  const weekData: Record<number, { days: ('done' | 'current' | 'upcoming')[] }> = {
    1: { days: ['done', 'done', 'done', 'done'] },
    2: { days: ['done', 'done', 'done', 'done'] },
    3: { days: ['done', 'done', 'current', 'upcoming'] },
    4: { days: ['upcoming', 'upcoming', 'upcoming', 'upcoming'] },
    5: { days: ['upcoming', 'upcoming', 'upcoming', 'upcoming'] },
    6: { days: ['upcoming', 'upcoming', 'upcoming', 'upcoming'] },
  };
  const current = weekData[activeWeek];
  const doneDays = current.days.filter(s => s === 'done').length;
  const weekPct = Math.round((doneDays / current.days.length) * 100);
  const isCurrentWeek = activeWeek === 3;

  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: T.text, fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80 }}>

      {/* Header — LiftFlow only on home */}
      <div style={{ padding: '48px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: T.textMuted, fontSize: 13, margin: '0 0 2px' }}>Welcome back</p>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Jordan M.</h1>
          </div>
          <div style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}44`, borderRadius: 99, padding: '4px 10px', marginTop: 4 }}>
            <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 800, letterSpacing: -0.3 }}>LiftFlow</span>
          </div>
        </div>
      </div>

      {/* Program card */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ ...card, padding: 20, border: `1px solid ${PRIMARY}44`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 140, height: 140, borderRadius: 70, background: `${PRIMARY}10`, pointerEvents: 'none' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: 4, background: SUCCESS }} />
                <span style={{ color: SUCCESS, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7 }}>Active</span>
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Strength Block 1</h2>
              <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>Coach: Alex T. · {totalWeeks} weeks · 4 days/wk</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Ring percent={weekPct} size={58} sw={5} />
              <span style={{ color: T.textDim, fontSize: 10 }}>this week</span>
            </div>
          </div>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button onClick={() => setActiveWeek(w => Math.max(1, w - 1))} disabled={activeWeek === 1}
              style={{ background: 'transparent', border: 'none', color: activeWeek > 1 ? T.textMuted : T.textDim, cursor: activeWeek > 1 ? 'pointer' : 'default', padding: '4px 6px', lineHeight: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Week {activeWeek}</span>
              <span style={{ color: T.textDim, fontSize: 13 }}> / {totalWeeks}</span>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 1, color: isCurrentWeek ? PRIMARY : activeWeek < 3 ? SUCCESS : T.textDim }}>
                {isCurrentWeek ? 'current' : activeWeek < 3 ? 'completed' : 'upcoming'}
              </div>
            </div>
            <button onClick={() => setActiveWeek(w => Math.min(totalWeeks, w + 1))} disabled={activeWeek === totalWeeks}
              style={{ background: 'transparent', border: 'none', color: activeWeek < totalWeeks ? T.textMuted : T.textDim, cursor: activeWeek < totalWeeks ? 'pointer' : 'default', padding: '4px 6px', lineHeight: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          {/* Day circles */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {current.days.map((state, i) => <DayCircle key={i} index={i} state={state} />)}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 16 }}>
            {isCurrentWeek
              ? <button style={{ background: PRIMARY, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, padding: '12px 0', width: '100%', cursor: 'pointer' }}>Continue — Day 3</button>
              : activeWeek < 3
                ? <button style={{ background: 'transparent', border: `1px solid ${T.cardBorder}`, borderRadius: 10, color: T.textMuted, fontSize: 13, fontWeight: 600, padding: '10px 0', width: '100%', cursor: 'pointer' }}>View Week {activeWeek}</button>
                : <button style={{ background: 'transparent', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, color: T.textDim, fontSize: 13, padding: '10px 0', width: '100%', cursor: 'default' }}>Locked</button>
            }
          </div>
        </div>
      </div>

      {/* PRs */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Personal Records</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[{ label: 'Squat', value: '185', unit: 'kg' }, { label: 'Deadlift', value: '220', unit: 'kg' }, { label: 'Bench', value: '120', unit: 'kg' }].map(pr => (
            <div key={pr.label} style={{ ...card, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <p style={{ color: T.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 8px' }}>{pr.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: GOLD }}>{pr.value}</p>
              <p style={{ fontSize: 10, color: T.textDim, margin: '3px 0 0' }}>{pr.unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Previous programs */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Previous Programs</h2>
        {[{ title: 'Hypertrophy Phase', weeks: 8, days: 5 }, { title: 'Foundation 101', weeks: 4, days: 3 }].map((p, i) => (
          <div key={i} style={{ ...card, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{p.title}</h3>
              <p style={{ color: T.textMuted, fontSize: 11, margin: '3px 0 0' }}>{p.weeks}W · {p.days}D/wk</p>
            </div>
            <span style={{ color: T.textDim, fontSize: 11, fontWeight: 600 }}>Completed</span>
          </div>
        ))}
      </div>

      {/* Tab Bar — 3 tabs for clients */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: 'rgba(15,15,15,0.96)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(20px)', zIndex: 50 }}>
        {[
          { label: 'Home', active: true, path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/> },
          { label: 'Messages', active: false, path: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/> },
          { label: 'Profile', active: false, path: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
        ].map((tab, i) => (
          <div key={i} style={{ color: tab.active ? PRIMARY : T.textDim, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{tab.path}</svg>
            <span style={{ fontSize: 9, fontWeight: tab.active ? 600 : 400 }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
