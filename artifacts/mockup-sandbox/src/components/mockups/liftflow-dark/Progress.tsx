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

const SmallRing = ({ percent, color }: { percent: number; color: string }) => {
  const size = 52, sw = 5, cx = size / 2, cy = size / 2, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r, offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={sw} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`} />
      </svg>
      <span style={{ zIndex: 1, fontSize: 11, fontWeight: 700, color }}>{percent}%</span>
    </div>
  );
};

// Same LiftFlow badge used on every tab screen
const LiftFlowBadge = () => (
  <div style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}44`, borderRadius: 99, padding: '4px 10px' }}>
    <span style={{ color: PRIMARY, fontSize: 13, fontWeight: 800, letterSpacing: -0.3 }}>LiftFlow</span>
  </div>
);

export default function Progress() {
  const [dark, setDark] = useState(true);
  const t = dark ? DARK : LIGHT;

  const card: React.CSSProperties = {
    background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
    backdropFilter: dark ? 'blur(12px)' : undefined,
    boxShadow: dark ? undefined : '0 1px 4px rgba(0,0,0,0.07)',
  };

  const clients = [
    { initial: 'J', name: 'Jordan M', pct: 84, status: SUCCESS, last: '2h ago', reviews: 3 },
    { initial: 'C', name: 'Casey R', pct: 52, status: WARNING, last: 'Yesterday', reviews: 1 },
    { initial: 'T', name: 'Taylor B', pct: 23, status: '#FF3B30', last: '3d ago', reviews: 0 },
  ];

  return (
    <div style={{ width: 390, minHeight: '100vh', background: t.bg, color: t.text, fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 80, transition: 'background 0.3s' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: t.text }}>Client Progress</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LiftFlowBadge />
            <button onClick={() => setDark(!dark)} style={{ background: t.toggleBg, border: 'none', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      {/* Overview row */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { value: '9', label: 'Active This Week', color: SUCCESS },
          { value: '68%', label: 'Roster Adherence', color: PRIMARY },
          { value: '2', label: 'Gone Quiet', color: WARNING },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '12px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ color: t.textMuted, fontSize: 10, textAlign: 'center' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Client list */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, marginTop: 0, color: t.text }}>
          Clients <span style={{ color: WARNING, fontSize: 13, fontWeight: 600 }}>· 2 gone quiet</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((c) => (
            <div key={c.name} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, border: `2px solid ${c.status}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c.status}15`, fontSize: 17, fontWeight: 700, color: c.status, flexShrink: 0 }}>
                    {c.initial}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{c.name}</span>
                      <div style={{ width: 7, height: 7, borderRadius: 4, background: c.status }} />
                    </div>
                    <div style={{ width: 100, height: 4, borderRadius: 2, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', width: `${c.pct}%`, background: c.status, borderRadius: 2 }} />
                    </div>
                    <span style={{ color: t.textDim, fontSize: 10 }}>Last active {c.last}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <SmallRing percent={c.pct} color={c.status} />
                  {/* Pending reviews counter */}
                  {c.reviews > 0 && (
                    <div style={{ background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}44`, borderRadius: 99, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span style={{ color: PRIMARY, fontSize: 10, fontWeight: 700 }}>{c.reviews} to review</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, height: 64, background: t.tabBar, borderTop: `1px solid ${t.tabBarBorder}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', backdropFilter: 'blur(20px)', zIndex: 50 }}>
        {[
          { path: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>, active: false },
          { path: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>, active: true },
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
