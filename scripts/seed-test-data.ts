import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEYS = {
  PRs: 'liftflow_prs',
  PROGRAMS: 'liftflow_programs',
  PROFILE: 'liftflow_profile',
  CLIENTS: 'liftflow_clients',
  NOTIFICATIONS: 'liftflow_notifications',
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function uuid() {
  return Crypto.randomUUID();
}

function makeExercise(name: string, repsSets: string, weight: string, rpe: string, completed = false, clientNotes = '', coachComment = '', videoUrl = '') {
  return {
    id: uuid(),
    name,
    weight,
    repsSets,
    rpe,
    isCompleted: completed,
    notes: '',
    clientNotes,
    coachComment,
    videoUrl,
  };
}

function makeProgram(title: string, description: string, coachId: string, clientId: string | null, daysPerWeek: number, weekCount: number, exerciseTemplates: any[][], status: 'active' | 'draft' | 'completed' = 'active') {
  const weeks = [];
  for (let w = 1; w <= weekCount; w++) {
    const days = [];
    for (let d = 1; d <= daysPerWeek; d++) {
      const dayIdx = (d - 1) % exerciseTemplates.length;
      const exercises = exerciseTemplates[dayIdx].map((ex: any) => makeExercise(
        ex.name,
        ex.repsSets,
        ex.weight || '',
        ex.rpe || '7',
        ex.completed || false,
        ex.clientNotes || '',
        ex.coachComment || '',
        ex.videoUrl || '',
      ));
      days.push({ dayNumber: d, exercises });
    }
    weeks.push({ weekNumber: w, days });
  }

  return {
    id: uuid(),
    title,
    description,
    weeks,
    createdAt: new Date().toISOString(),
    daysPerWeek,
    shareCode: generateCode(),
    coachId,
    clientId,
    status,
  };
}

export async function seedTestData() {
  const coachId = uuid();
  const client1Id = uuid();
  const client2Id = uuid();
  const client3Id = uuid();

  const profile = {
    id: coachId,
    name: 'Coach Mike',
    role: 'coach',
    weightUnit: 'kg',
    coachCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
  };

  const clients = [
    { id: client1Id, name: 'Sarah J.', joinedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: client2Id, name: 'Alex T.', joinedAt: new Date(Date.now() - 14 * 86400000).toISOString() },
    { id: client3Id, name: 'Coach Mike', joinedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
  ];

  const sarahProgram = makeProgram(
    'Strength Block A',
    '8-week progressive overload program for Sarah',
    coachId,
    client1Id,
    4,
    8,
    [
      [
        { name: 'Back Squat', repsSets: '5x5', weight: '80', rpe: '8', completed: true, clientNotes: 'Felt strong today, depth was good', coachComment: 'Great job, try 82.5 next week' },
        { name: 'Romanian Deadlift', repsSets: '3x10', weight: '60', rpe: '7', completed: true, clientNotes: 'Slight hamstring tightness' },
        { name: 'Leg Press', repsSets: '4x12', weight: '120', rpe: '7', completed: true },
        { name: 'Walking Lunges', repsSets: '3x12 each', weight: '16', rpe: '6', completed: false },
      ],
      [
        { name: 'Bench Press', repsSets: '5x5', weight: '50', rpe: '8', completed: true, videoUrl: 'https://example.com/sarah-bench.mp4', clientNotes: 'Elbow flare on last 2 reps', coachComment: 'Tuck elbows more, good overall form' },
        { name: 'Incline DB Press', repsSets: '4x8', weight: '18', rpe: '7', completed: true },
        { name: 'Cable Flyes', repsSets: '3x15', weight: '10', rpe: '6', completed: false },
        { name: 'Tricep Pushdown', repsSets: '3x12', weight: '20', rpe: '7', completed: false },
      ],
      [
        { name: 'Deadlift', repsSets: '3x5', weight: '100', rpe: '9', completed: true, videoUrl: 'https://example.com/sarah-dl.mp4', clientNotes: 'PR attempt - got all reps!', coachComment: 'Incredible pull! Back stays tight throughout' },
        { name: 'Pull-ups', repsSets: '4x6', weight: 'BW', rpe: '8', completed: true },
        { name: 'Barbell Row', repsSets: '4x8', weight: '50', rpe: '7', completed: false },
        { name: 'Face Pulls', repsSets: '3x15', weight: '12', rpe: '5', completed: false },
      ],
      [
        { name: 'Overhead Press', repsSets: '4x6', weight: '35', rpe: '8', completed: false },
        { name: 'Lateral Raises', repsSets: '4x12', weight: '8', rpe: '7', completed: false },
        { name: 'Rear Delt Flyes', repsSets: '3x15', weight: '6', rpe: '6', completed: false },
        { name: 'Barbell Curl', repsSets: '3x10', weight: '20', rpe: '6', completed: false },
      ],
    ]
  );

  const alexProgram = makeProgram(
    'Hypertrophy Phase 1',
    '6-week muscle building block for Alex',
    coachId,
    client2Id,
    3,
    6,
    [
      [
        { name: 'Squat', repsSets: '4x8', weight: '70', rpe: '7', completed: true, clientNotes: 'Knees feel better this week' },
        { name: 'Leg Curl', repsSets: '3x12', weight: '35', rpe: '7', completed: true },
        { name: 'Leg Extension', repsSets: '3x12', weight: '40', rpe: '7', completed: true },
        { name: 'Calf Raise', repsSets: '4x15', weight: '60', rpe: '6', completed: false },
      ],
      [
        { name: 'Bench Press', repsSets: '4x8', weight: '65', rpe: '7', completed: true, coachComment: 'Good tempo, keep it up' },
        { name: 'DB Row', repsSets: '4x10', weight: '28', rpe: '7', completed: true },
        { name: 'Dips', repsSets: '3x10', weight: 'BW+10', rpe: '8', completed: false },
        { name: 'Cable Curl', repsSets: '3x12', weight: '15', rpe: '6', completed: false },
      ],
      [
        { name: 'Sumo Deadlift', repsSets: '3x6', weight: '110', rpe: '8', completed: false, clientNotes: 'Lower back was sore from work, skipped this session' },
        { name: 'Lat Pulldown', repsSets: '4x10', weight: '55', rpe: '7', completed: false },
        { name: 'Seated OHP', repsSets: '3x10', weight: '25', rpe: '7', completed: false },
        { name: 'Hammer Curls', repsSets: '3x10', weight: '14', rpe: '6', completed: false },
      ],
    ]
  );

  const selfProgram = makeProgram(
    'My Own Training',
    'Coach Mike personal offseason program',
    coachId,
    client3Id,
    5,
    4,
    [
      [
        { name: 'Competition Squat', repsSets: '5x3', weight: '140', rpe: '8', completed: true },
        { name: 'Pause Squat', repsSets: '3x3', weight: '110', rpe: '7', completed: true },
        { name: 'Belt Squat', repsSets: '3x10', weight: '80', rpe: '6', completed: true },
      ],
      [
        { name: 'Competition Bench', repsSets: '5x3', weight: '110', rpe: '8', completed: true, clientNotes: 'Good speed off chest' },
        { name: 'Close Grip Bench', repsSets: '3x6', weight: '90', rpe: '7', completed: true },
        { name: 'DB Flye', repsSets: '3x12', weight: '20', rpe: '6', completed: false },
      ],
      [
        { name: 'Competition Deadlift', repsSets: '3x3', weight: '180', rpe: '9', completed: true, videoUrl: 'https://example.com/mike-dl.mp4' },
        { name: 'Block Pull', repsSets: '3x3', weight: '200', rpe: '7', completed: true },
        { name: 'Barbell Row', repsSets: '4x8', weight: '80', rpe: '7', completed: false },
      ],
      [
        { name: 'OHP', repsSets: '4x6', weight: '70', rpe: '7', completed: false },
        { name: 'Weighted Pull-ups', repsSets: '4x6', weight: 'BW+20', rpe: '8', completed: false },
        { name: 'Lateral Raises', repsSets: '4x15', weight: '12', rpe: '6', completed: false },
      ],
      [
        { name: 'Front Squat', repsSets: '3x5', weight: '100', rpe: '7', completed: false },
        { name: 'Good Morning', repsSets: '3x8', weight: '60', rpe: '6', completed: false },
        { name: 'Ab Wheel', repsSets: '3x12', weight: 'BW', rpe: '6', completed: false },
      ],
    ]
  );

  const programs = [sarahProgram, alexProgram, selfProgram];

  const notifications = [
    {
      id: uuid(),
      type: 'video',
      title: 'Form Check Video',
      message: 'Sarah uploaded a video for Bench Press',
      programId: sarahProgram.id,
      programTitle: sarahProgram.title,
      exerciseName: 'Bench Press',
      fromRole: 'client',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      read: false,
    },
    {
      id: uuid(),
      type: 'notes',
      title: 'New Client Notes',
      message: 'Sarah added notes on Deadlift: "PR attempt - got all reps!"',
      programId: sarahProgram.id,
      programTitle: sarahProgram.title,
      exerciseName: 'Deadlift',
      fromRole: 'client',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      read: false,
    },
    {
      id: uuid(),
      type: 'completion',
      title: 'Exercise Completed',
      message: 'Alex completed Bench Press',
      programId: alexProgram.id,
      programTitle: alexProgram.title,
      exerciseName: 'Bench Press',
      fromRole: 'client',
      createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
      read: true,
    },
    {
      id: uuid(),
      type: 'notes',
      title: 'New Client Notes',
      message: 'Alex added notes on Sumo Deadlift: "Lower back was sore from work"',
      programId: alexProgram.id,
      programTitle: alexProgram.title,
      exerciseName: 'Sumo Deadlift',
      fromRole: 'client',
      createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      read: true,
    },
    {
      id: uuid(),
      type: 'video',
      title: 'Form Check Video',
      message: 'Sarah uploaded a video for Deadlift',
      programId: sarahProgram.id,
      programTitle: sarahProgram.title,
      exerciseName: 'Deadlift',
      fromRole: 'client',
      createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      read: true,
    },
  ];

  const prs = [
    { id: uuid(), liftType: 'squat', weight: 145, unit: 'kg', date: new Date(Date.now() - 7 * 86400000).toISOString(), notes: 'Comp squat PR' },
    { id: uuid(), liftType: 'bench', weight: 115, unit: 'kg', date: new Date(Date.now() - 14 * 86400000).toISOString(), notes: '' },
    { id: uuid(), liftType: 'deadlift', weight: 185, unit: 'kg', date: new Date(Date.now() - 3 * 86400000).toISOString(), notes: 'Conventional' },
  ];

  await AsyncStorage.multiSet([
    [KEYS.PROFILE, JSON.stringify(profile)],
    [KEYS.CLIENTS, JSON.stringify(clients)],
    [KEYS.PROGRAMS, JSON.stringify(programs)],
    [KEYS.NOTIFICATIONS, JSON.stringify(notifications)],
    [KEYS.PRs, JSON.stringify(prs)],
  ]);

  return { profile, clients, programs, notifications, prs };
}
