import React from 'react';

export default function Progress() {
  const cardStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
  };

  const percent = 72;
  const size = 140;
  const strokeWidth = 12;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="w-[390px] min-h-screen text-white font-sans overflow-y-auto pb-24 relative" style={{ background: 'linear-gradient(to bottom, #1a0a2e, #0a0a1a)' }}>
      {/* Header */}
      <div className="p-6 pt-12 text-center">
        <h1 className="text-2xl font-bold">Progress</h1>
        <p className="text-gray-400 text-sm font-medium mt-1">This Week</p>
      </div>

      {/* Big Ring */}
      <div className="flex justify-center mb-8">
        <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <defs>
              <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
            <circle 
              cx={cx} cy={cy} r={r} 
              fill="none" 
              stroke="url(#ringGradient)" 
              strokeWidth={strokeWidth}
              strokeDasharray={circumference} 
              strokeDashoffset={offset}
              strokeLinecap="round" 
              transform={`rotate(-90, ${cx}, ${cy})`} 
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white leading-none">72%</span>
            <span className="text-gray-400 text-xs font-medium mt-1">Complete</span>
          </div>
        </div>
      </div>

      {/* Week Day Pills */}
      <div className="px-6 flex justify-between items-center mb-8">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
          let statusColor = "bg-gray-800";
          let textColor = "text-gray-500";
          if (i < 4) {
             statusColor = "bg-[#22c55e]";
             textColor = "text-white";
          } else if (i === 4) {
             statusColor = "bg-[#facc15]";
             textColor = "text-black";
          }

          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-gray-400 text-xs">{day}</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${statusColor} ${textColor}`}>
                {i < 4 ? "✓" : (i === 4 ? "−" : "")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Personal Records */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold mb-4">Personal Records</h2>
        <div className="grid grid-cols-3 gap-3">
          <div style={cardStyle} className="p-3 flex flex-col items-center text-center">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">Best Squat</p>
            <p className="text-xl font-bold mb-1">185<span className="text-xs text-gray-400 ml-1">kg</span></p>
            <div className="bg-[#22c55e] bg-opacity-20 text-[#22c55e] text-[10px] font-bold px-2 py-0.5 rounded-full">↑ 5kg</div>
          </div>
          <div style={cardStyle} className="p-3 flex flex-col items-center text-center">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">Best Deadlift</p>
            <p className="text-xl font-bold mb-1">220<span className="text-xs text-gray-400 ml-1">kg</span></p>
            <div className="bg-[#22c55e] bg-opacity-20 text-[#22c55e] text-[10px] font-bold px-2 py-0.5 rounded-full">↑ 10kg</div>
          </div>
          <div style={cardStyle} className="p-3 flex flex-col items-center text-center">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-2">Best Bench</p>
            <p className="text-xl font-bold mb-1">120<span className="text-xs text-gray-400 ml-1">kg</span></p>
            <div className="bg-gray-600 bg-opacity-30 text-gray-400 text-[10px] font-bold px-2 py-0.5 rounded-full">→ Same</div>
          </div>
        </div>
      </div>

      {/* Streak Row */}
      <div className="px-4 mb-8">
        <div style={cardStyle} className="p-4 flex justify-between items-center divide-x divide-white/10">
          <div className="px-2 text-center w-1/3">
            <p className="text-sm font-bold text-[#f97316]">14 Day</p>
            <p className="text-xs text-gray-400">Streak 🔥</p>
          </div>
          <div className="px-2 text-center w-1/3">
            <p className="text-sm font-bold">32</p>
            <p className="text-xs text-gray-400">Sessions</p>
          </div>
          <div className="px-2 text-center w-1/3">
            <p className="text-sm font-bold text-[#3b82f6]">4.2h</p>
            <p className="text-xs text-gray-400">Avg/Week</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4">
        <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
        <div className="flex flex-col gap-3">
          {[
            { title: "Upper Body A", date: "Mon Mar 18", details: "8 exercises · 58 min" },
            { title: "Lower Body B", date: "Tue Mar 19", details: "6 exercises · 45 min" },
            { title: "Push Day", date: "Wed Mar 20", details: "7 exercises · 51 min" }
          ].map((activity, i) => (
            <div key={i} style={cardStyle} className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{activity.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[#a855f7] text-xs font-medium">{activity.date}</span>
                  <span className="text-gray-600 text-xs">•</span>
                  <span className="text-gray-400 text-xs">{activity.details}</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#22c55e] bg-opacity-20 flex items-center justify-center text-[#22c55e]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="absolute bottom-0 w-[390px] h-[60px] bg-[#0a0a1a] border-t border-white/10 flex justify-around items-center px-6 text-gray-400 backdrop-blur-md bg-opacity-90 z-50">
        <div className="flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div className="flex flex-col items-center text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
        </div>
        <div className="flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <div className="flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
      </div>
    </div>
  );
}
