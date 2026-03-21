import React from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const WARNING = '#FF9500';
const GOLD = '#FFB800';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

// Small ring used inline in stat cards
const SmallRing = ({ percent, color }: { percent: number; color: string }) => {
  const size = 52, sw = 5;
  const cx = size / 2, cy = size / 2;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <span style={{ zIndex: 1, fontSize: 11, fontWeight: 700, color: '#fff' }}>{percent}%</span>
    </div>
  );
};

export default function Progress() {
  // Big adherence ring
  const percent = 68;
  const size = 148, sw = 12;
  const cx = size / 2, cy = size / 2;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  const clients = [
    { initial: 'J', name: 'Jordan M', pct: 84, status: SUCCESS, last: '2h ago' },
    { initial: 'C', name: 'Casey R', pct: 52, status: WARNING, last: 'Yesterday' },
    { initial: 'T', name: 'Taylor B', pct: 23, status: '#FF3B30', last: '3d ago' },
  ];

  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Client Progress</h1>
      </div>

      {/* Overview row — 3 small stats */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ ...card, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: SUCCESS, lineHeight: 1 }}>9</span>
          <span style={{ color: '#888', fontSize: 10, textAlign: 'center' }}>Active This Week</span>
        </div>
        <div style={{ ...card, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: PRIMARY, lineHeight: 1 }}>68%</span>
          <span style={{ color: '#888', fontSize: 10, textAlign: 'center' }}>Roster Adherence</span>
        </div>
        <div style={{ ...card, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: WARNING, lineHeight: 1 }}>2</span>
          <span style={{ color: '#888', fontSize: 10, textAlign: 'center' }}>Gone Quiet</span>
        </div>
      </div>

      {/* Client list */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>
          Clients <span style={{ color: WARNING, fontSize: 13, fontWeight: 600 }}>· 2 gone quiet</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((c) => (
            <div key={c.name} style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${c.status}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', fontSize: 17, fontWeight: 700, flexShrink: 0 }}>
                  {c.initial}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                    <div style={{ width: 7, height: 7, borderRadius: 4, background: c.status }} />
                  </div>
                  {/* Mini adherence bar */}
                  <div style={{ width: 110, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: c.status, borderRadius: 2 }} />
                  </div>
                  <span style={{ color: '#555', fontSize: 10 }}>Last active {c.last}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <SmallRing percent={c.pct} color={c.status} />
              </div>
            </div>
          ))}
        </div>
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
