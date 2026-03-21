import React, { useState } from 'react';

const PRIMARY = '#E8512F';
const SUCCESS = '#34C759';
const BG = 'linear-gradient(160deg, #1c1c1c 0%, #111111 50%, #0F0F0F 100%)';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
};

const exercises = [
  { name: 'Back Squat', sets: 4, reps: '6', weight: '100kg', note: 'Drive through heels', done: true, hasVideo: true },
  { name: 'Romanian Deadlift', sets: 3, reps: '10', weight: '80kg', note: 'Keep back flat', done: true, hasVideo: false },
  { name: 'Leg Press', sets: 3, reps: '12', weight: '140kg', note: '', done: false, hasVideo: false },
  { name: 'Leg Curl', sets: 3, reps: '12', weight: '40kg', note: 'Slow eccentric', done: false, hasVideo: false },
  { name: 'Calf Raises', sets: 4, reps: '15', weight: 'Bodyweight', note: '', done: false, hasVideo: false },
];

export default function ExerciseView() {
  const completedCount = exercises.filter(e => e.done).length;
  const pct = Math.round((completedCount / exercises.length) * 100);

  return (
    <div style={{ width: 390, minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'system-ui,-apple-system,sans-serif', overflowY: 'auto', paddingBottom: 100, position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '48px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ color: '#888', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </div>
          <div>
            <p style={{ color: '#888', fontSize: 12, margin: 0 }}>Strength Block 1 · Week 3</p>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>Day 3 — Lower Body</h1>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#888', fontSize: 11 }}>{completedCount} of {exercises.length} exercises</span>
            <span style={{ color: PRIMARY, fontSize: 11, fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${PRIMARY}, #FF8C42)`, borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Exercise List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((ex, i) => (
          <div key={i} style={{
            ...card,
            padding: '14px 16px',
            border: ex.done ? `1px solid ${SUCCESS}33` : '1px solid rgba(255,255,255,0.09)',
            opacity: ex.done ? 0.85 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: ex.note || !ex.done ? 10 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Check circle */}
                <div style={{
                  width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                  background: ex.done ? `${SUCCESS}22` : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${ex.done ? SUCCESS : 'rgba(255,255,255,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {ex.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={SUCCESS} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, textDecoration: ex.done ? 'line-through' : 'none', color: ex.done ? '#888' : '#fff' }}>{ex.name}</p>
                  <p style={{ margin: '3px 0 0', color: '#666', fontSize: 12 }}>{ex.sets} sets · {ex.reps} reps · {ex.weight}</p>
                </div>
              </div>
              {ex.hasVideo && (
                <div style={{ background: `${PRIMARY}22`, color: PRIMARY, padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                  Video ✓
                </div>
              )}
            </div>

            {ex.note && (
              <p style={{ margin: '0 0 10px 34px', color: '#666', fontSize: 11, fontStyle: 'italic' }}>📝 {ex.note}</p>
            )}

            {/* Actions for incomplete exercises */}
            {!ex.done && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 34 }}>
                <button style={{
                  flex: 1, background: 'transparent', border: `1px solid ${PRIMARY}`, borderRadius: 8,
                  color: PRIMARY, fontSize: 12, fontWeight: 600, padding: '8px 0', cursor: 'pointer',
                }}>
                  Upload Form Video
                </button>
                <button style={{
                  flex: 1, background: PRIMARY, border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 0', cursor: 'pointer',
                }}>
                  Mark Done
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky bottom — finish workout */}
      <div style={{ position: 'fixed', bottom: 0, width: 390, padding: '12px 16px', background: 'rgba(15,15,15,0.97)', borderTop: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', zIndex: 50 }}>
        <button style={{
          width: '100%', background: `linear-gradient(90deg, ${PRIMARY}, #FF8C42)`, border: 'none',
          borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, padding: '14px 0', cursor: 'pointer', letterSpacing: 0.3,
        }}>
          Finish Workout
        </button>
      </div>
    </div>
  );
}
