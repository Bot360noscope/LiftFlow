import React from 'react';

// Reusable SVG Ring Component
const Ring = ({ 
  percent, 
  color, 
  size = 128, 
  strokeWidth = 10,
  label = "",
  subLabel = ""
}: { 
  percent: number, 
  color: string, 
  size?: number, 
  strokeWidth?: number,
  label?: string,
  subLabel?: string
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <circle 
          cx={cx} cy={cy} r={r} 
          fill="none" 
          stroke={color} 
          strokeWidth={strokeWidth}
          strokeDasharray={circumference} 
          strokeDashoffset={offset}
          strokeLinecap="round" 
          transform={`rotate(-90, ${cx}, ${cy})`} 
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <span className="text-white font-bold" style={{ fontSize: size * 0.25 }}>{label}</span>}
        {subLabel && <span className="text-gray-400 text-xs font-medium">{subLabel}</span>}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const cardStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
  };

  return (
    <div className="w-[390px] min-h-screen text-white font-sans overflow-y-auto pb-24 relative" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #0a0a1a)' }}>
      {/* Header */}
      <div className="p-6 pt-12">
        <div className="flex justify-between items-end mb-1">
          <p className="text-gray-400 text-sm font-medium">Good morning, Alex</p>
          <p className="text-[#a855f7] font-bold tracking-tight">LiftFlow</p>
        </div>
        <h1 className="text-2xl font-bold">Monday, March 21</h1>
      </div>

      {/* Stats Grid */}
      <div className="px-4 grid grid-cols-2 gap-4 mb-8">
        {/* Recovery Ring Card */}
        <div style={cardStyle} className="p-4 flex flex-col items-center justify-center">
          <Ring percent={68} color="#22c55e" size={100} strokeWidth={8} label="68%" />
          <p className="text-gray-400 text-xs mt-3 font-medium text-center">Weekly Adherence</p>
        </div>

        {/* Clients Ring Card */}
        <div style={cardStyle} className="p-4 flex flex-col items-center justify-center">
          <Ring percent={(9/12)*100} color="#3b82f6" size={100} strokeWidth={8} label="9/12" />
          <p className="text-gray-400 text-xs mt-3 font-medium text-center">Active Clients</p>
        </div>

        {/* Small Number Card 1 */}
        <div style={cardStyle} className="p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-4xl font-bold">47</span>
            <div className="bg-[#f97316] bg-opacity-20 text-[#f97316] p-2 rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            </div>
          </div>
          <p className="text-[#f97316] text-xs font-semibold mt-2">Pending Reviews</p>
        </div>

        {/* Small Number Card 2 */}
        <div style={cardStyle} className="p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-4xl font-bold">3</span>
            <div className="bg-[#a855f7] bg-opacity-20 text-[#a855f7] p-2 rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
            </div>
          </div>
          <p className="text-gray-400 text-xs font-medium mt-2">New PRs</p>
        </div>
      </div>

      {/* Client List */}
      <div className="px-4">
        <h2 className="text-lg font-bold mb-4">Client Overview</h2>
        <div className="flex flex-col gap-3">
          {/* Client 1 */}
          <div style={cardStyle} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-[#22c55e] flex items-center justify-center bg-gray-800 text-lg font-bold">
                J
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">Jordan M</h3>
                  <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                </div>
                <p className="text-gray-400 text-xs">2h ago</p>
              </div>
            </div>
            <Ring percent={84} color="#22c55e" size={40} strokeWidth={4} />
          </div>

          {/* Client 2 */}
          <div style={cardStyle} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-[#f97316] flex items-center justify-center bg-gray-800 text-lg font-bold">
                C
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">Casey R</h3>
                  <div className="w-2 h-2 rounded-full bg-[#f97316]"></div>
                </div>
                <p className="text-gray-400 text-xs">Yesterday</p>
              </div>
            </div>
            <Ring percent={52} color="#f97316" size={40} strokeWidth={4} />
          </div>

          {/* Client 3 */}
          <div style={cardStyle} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-[#ef4444] flex items-center justify-center bg-gray-800 text-lg font-bold">
                T
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">Taylor B</h3>
                  <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                </div>
                <p className="text-gray-400 text-xs">3d ago</p>
              </div>
            </div>
            <Ring percent={23} color="#ef4444" size={40} strokeWidth={4} />
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="absolute bottom-0 w-[390px] h-[60px] bg-[#0a0a1a] border-t border-white/10 flex justify-around items-center px-6 text-gray-400 backdrop-blur-md bg-opacity-90 z-50">
        <div className="flex flex-col items-center text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div className="flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <div className="flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div className="flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
      </div>
    </div>
  );
}
