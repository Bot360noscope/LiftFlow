import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface LiftPR {
  id: string;
  liftType: 'squat' | 'deadlift' | 'bench';
  weight: number;
  unit: 'kg' | 'lbs';
  date: string;
  notes: string;
}

export interface Exercise {
  id: string;
  name: string;
  weight: string;
  repsSets: string;
  rpe: string;
  isCompleted: boolean;
  notes: string;
  clientNotes: string;
  coachComment: string;
  videoUrl: string;
}

export interface WorkoutDay {
  dayNumber: number;
  exercises: Exercise[];
}

export interface WorkoutWeek {
  weekNumber: number;
  days: WorkoutDay[];
}

export interface Program {
  id: string;
  title: string;
  description: string;
  weeks: WorkoutWeek[];
  createdAt: string;
  daysPerWeek: number;
  shareCode: string;
  coachId: string;
  clientId: string | null;
  status: 'draft' | 'active' | 'completed';
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'coach' | 'client';
  weightUnit: 'kg' | 'lbs';
  coachCode: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  joinedAt: string;
}

export interface AppNotification {
  id: string;
  type: 'video' | 'notes' | 'comment' | 'completion';
  title: string;
  message: string;
  programId: string;
  programTitle: string;
  exerciseName: string;
  fromRole: 'coach' | 'client';
  createdAt: string;
  read: boolean;
}

const KEYS = {
  PRs: 'liftflow_prs',
  PROGRAMS: 'liftflow_programs',
  PROFILE: 'liftflow_profile',
  CLIENTS: 'liftflow_clients',
  NOTIFICATIONS: 'liftflow_notifications',
};

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getPRs(): Promise<LiftPR[]> {
  const data = await AsyncStorage.getItem(KEYS.PRs);
  return data ? JSON.parse(data) : [];
}

export async function addPR(pr: Omit<LiftPR, 'id'>): Promise<LiftPR> {
  const prs = await getPRs();
  const newPR: LiftPR = { ...pr, id: Crypto.randomUUID() };
  prs.push(newPR);
  await AsyncStorage.setItem(KEYS.PRs, JSON.stringify(prs));
  return newPR;
}

export async function deletePR(id: string): Promise<void> {
  const prs = await getPRs();
  const filtered = prs.filter(pr => pr.id !== id);
  await AsyncStorage.setItem(KEYS.PRs, JSON.stringify(filtered));
}

export async function getPrograms(): Promise<Program[]> {
  const data = await AsyncStorage.getItem(KEYS.PROGRAMS);
  if (!data) return [];
  const parsed = JSON.parse(data);
  return parsed.filter((p: any) => p.weeks && Array.isArray(p.weeks));
}

export async function getProgram(id: string): Promise<Program | null> {
  const programs = await getPrograms();
  return programs.find(p => p.id === id) || null;
}

export async function addProgram(program: Omit<Program, 'id' | 'createdAt' | 'shareCode'>): Promise<Program> {
  const programs = await getPrograms();
  const newProgram: Program = {
    ...program,
    id: Crypto.randomUUID(),
    shareCode: generateCode(),
    createdAt: new Date().toISOString(),
  };
  programs.push(newProgram);
  await AsyncStorage.setItem(KEYS.PROGRAMS, JSON.stringify(programs));
  return newProgram;
}

export async function updateProgram(program: Program): Promise<void> {
  const programs = await getPrograms();
  const idx = programs.findIndex(p => p.id === program.id);
  if (idx !== -1) {
    programs[idx] = program;
    await AsyncStorage.setItem(KEYS.PROGRAMS, JSON.stringify(programs));
  }
}

export async function deleteProgram(id: string): Promise<void> {
  const programs = await getPrograms();
  const filtered = programs.filter(p => p.id !== id);
  await AsyncStorage.setItem(KEYS.PROGRAMS, JSON.stringify(filtered));
}

export async function getProfile(): Promise<UserProfile> {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  if (data) return JSON.parse(data);
  const defaultProfile: UserProfile = {
    id: Crypto.randomUUID(),
    name: '',
    role: 'client',
    weightUnit: 'kg',
    coachCode: generateCode(),
  };
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(defaultProfile));
  return defaultProfile;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

export async function resetCoachCode(): Promise<string> {
  const profile = await getProfile();
  const newCode = generateCode();
  profile.coachCode = newCode;
  await saveProfile(profile);
  return newCode;
}

export function getBestPR(prs: LiftPR[], liftType: string): LiftPR | null {
  const filtered = prs.filter(p => p.liftType === liftType);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, curr) => curr.weight > best.weight ? curr : best);
}

export async function getClients(): Promise<ClientInfo[]> {
  const data = await AsyncStorage.getItem(KEYS.CLIENTS);
  return data ? JSON.parse(data) : [];
}

export async function addClient(client: Omit<ClientInfo, 'joinedAt'>): Promise<void> {
  const clients = await getClients();
  if (clients.some(c => c.id === client.id)) return;
  clients.push({ ...client, joinedAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
}

export async function removeClient(id: string): Promise<void> {
  const clients = await getClients();
  const filtered = clients.filter(c => c.id !== id);
  await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(filtered));
}

export async function getNotifications(): Promise<AppNotification[]> {
  const data = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
  return data ? JSON.parse(data) : [];
}

export async function addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<void> {
  const notifications = await getNotifications();
  notifications.unshift({
    ...notification,
    id: Crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
  });
  if (notifications.length > 50) notifications.length = 50;
  await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export async function markNotificationRead(id: string): Promise<void> {
  const notifications = await getNotifications();
  const n = notifications.find(n => n.id === id);
  if (n) {
    n.read = true;
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const notifications = await getNotifications();
  notifications.forEach(n => n.read = true);
  await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const notifications = await getNotifications();
  return notifications.filter(n => !n.read).length;
}

export async function seedDemoData(): Promise<void> {
  const coachId = Crypto.randomUUID();
  const client1Id = Crypto.randomUUID();
  const client2Id = Crypto.randomUUID();
  const client3Id = Crypto.randomUUID();

  function ex(name: string, repsSets: string, weight: string, rpe: string, completed = false, clientNotes = '', coachComment = '', videoUrl = ''): Exercise {
    return { id: Crypto.randomUUID(), name, weight, repsSets, rpe, isCompleted: completed, notes: '', clientNotes, coachComment, videoUrl };
  }

  function makeProg(title: string, desc: string, clientId: string | null, dpw: number, wks: number, dayTemplates: Exercise[][]): Program {
    const weeks: WorkoutWeek[] = [];
    for (let w = 1; w <= wks; w++) {
      const days: WorkoutDay[] = [];
      for (let d = 1; d <= dpw; d++) {
        const tpl = dayTemplates[(d - 1) % dayTemplates.length];
        days.push({ dayNumber: d, exercises: tpl.map(e => ({ ...e, id: Crypto.randomUUID() })) });
      }
      weeks.push({ weekNumber: w, days });
    }
    return { id: Crypto.randomUUID(), title, description: desc, weeks, createdAt: new Date().toISOString(), daysPerWeek: dpw, shareCode: generateCode(), coachId, clientId, status: 'active' };
  }

  const sarahProg = makeProg('Strength Block A', '8-week progressive overload for Sarah', client1Id, 4, 8, [
    [ex('Back Squat','5x5','80','8',true,'Felt strong, depth good','Great job, try 82.5 next week'), ex('Romanian Deadlift','3x10','60','7',true,'Slight hamstring tightness'), ex('Leg Press','4x12','120','7',true), ex('Walking Lunges','3x12 each','16','6')],
    [ex('Bench Press','5x5','50','8',true,'Elbow flare on last 2 reps','Tuck elbows more, good form','https://example.com/vid1'), ex('Incline DB Press','4x8','18','7',true), ex('Cable Flyes','3x15','10','6'), ex('Tricep Pushdown','3x12','20','7')],
    [ex('Deadlift','3x5','100','9',true,'PR attempt - got all reps!','Incredible pull!','https://example.com/vid2'), ex('Pull-ups','4x6','BW','8',true), ex('Barbell Row','4x8','50','7'), ex('Face Pulls','3x15','12','5')],
    [ex('Overhead Press','4x6','35','8'), ex('Lateral Raises','4x12','8','7'), ex('Rear Delt Flyes','3x15','6','6'), ex('Barbell Curl','3x10','20','6')],
  ]);

  const alexProg = makeProg('Hypertrophy Phase 1', '6-week muscle building for Alex', client2Id, 3, 6, [
    [ex('Squat','4x8','70','7',true,'Knees feel better this week'), ex('Leg Curl','3x12','35','7',true), ex('Leg Extension','3x12','40','7',true), ex('Calf Raise','4x15','60','6')],
    [ex('Bench Press','4x8','65','7',true,'','Good tempo, keep it up'), ex('DB Row','4x10','28','7',true), ex('Dips','3x10','BW+10','8'), ex('Cable Curl','3x12','15','6')],
    [ex('Sumo Deadlift','3x6','110','8',false,'Lower back sore from work, skipped'), ex('Lat Pulldown','4x10','55','7'), ex('Seated OHP','3x10','25','7'), ex('Hammer Curls','3x10','14','6')],
  ]);

  const selfProg = makeProg('My Own Training', 'Coach Mike personal offseason', client3Id, 5, 4, [
    [ex('Competition Squat','5x3','140','8',true), ex('Pause Squat','3x3','110','7',true), ex('Belt Squat','3x10','80','6',true)],
    [ex('Competition Bench','5x3','110','8',true,'Good speed off chest'), ex('Close Grip Bench','3x6','90','7',true), ex('DB Flye','3x12','20','6')],
    [ex('Competition Deadlift','3x3','180','9',true,'','','https://example.com/vid3'), ex('Block Pull','3x3','200','7',true), ex('Barbell Row','4x8','80','7')],
    [ex('OHP','4x6','70','7'), ex('Weighted Pull-ups','4x6','BW+20','8'), ex('Lateral Raises','4x15','12','6')],
    [ex('Front Squat','3x5','100','7'), ex('Good Morning','3x8','60','6'), ex('Ab Wheel','3x12','BW','6')],
  ]);

  const profile: UserProfile = { id: coachId, name: 'Coach Mike', role: 'coach', weightUnit: 'kg', coachCode: 'LIFT42' };
  const clients: ClientInfo[] = [
    { id: client1Id, name: 'Sarah J.', joinedAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: client2Id, name: 'Alex T.', joinedAt: new Date(Date.now() - 14 * 86400000).toISOString() },
    { id: client3Id, name: 'Coach Mike', joinedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
  ];
  const notifications: AppNotification[] = [
    { id: Crypto.randomUUID(), type: 'video', title: 'Form Check Video', message: 'Sarah uploaded a video for Bench Press', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Bench Press', fromRole: 'client', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), read: false },
    { id: Crypto.randomUUID(), type: 'notes', title: 'New Client Notes', message: 'Sarah added notes on Deadlift: "PR attempt - got all reps!"', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Deadlift', fromRole: 'client', createdAt: new Date(Date.now() - 4 * 3600000).toISOString(), read: false },
    { id: Crypto.randomUUID(), type: 'completion', title: 'Exercise Completed', message: 'Alex completed Bench Press', programId: alexProg.id, programTitle: alexProg.title, exerciseName: 'Bench Press', fromRole: 'client', createdAt: new Date(Date.now() - 8 * 3600000).toISOString(), read: true },
    { id: Crypto.randomUUID(), type: 'notes', title: 'New Client Notes', message: 'Alex added notes: "Lower back was sore from work"', programId: alexProg.id, programTitle: alexProg.title, exerciseName: 'Sumo Deadlift', fromRole: 'client', createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), read: true },
    { id: Crypto.randomUUID(), type: 'video', title: 'Form Check Video', message: 'Sarah uploaded a video for Deadlift', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Deadlift', fromRole: 'client', createdAt: new Date(Date.now() - 48 * 3600000).toISOString(), read: true },
  ];
  const prs: LiftPR[] = [
    { id: Crypto.randomUUID(), liftType: 'squat', weight: 145, unit: 'kg', date: new Date(Date.now() - 7 * 86400000).toISOString(), notes: 'Comp squat PR' },
    { id: Crypto.randomUUID(), liftType: 'bench', weight: 115, unit: 'kg', date: new Date(Date.now() - 14 * 86400000).toISOString(), notes: '' },
    { id: Crypto.randomUUID(), liftType: 'deadlift', weight: 185, unit: 'kg', date: new Date(Date.now() - 3 * 86400000).toISOString(), notes: 'Conventional' },
  ];

  await AsyncStorage.multiSet([
    [KEYS.PROFILE, JSON.stringify(profile)],
    [KEYS.CLIENTS, JSON.stringify(clients)],
    [KEYS.PROGRAMS, JSON.stringify([sarahProg, alexProg, selfProg])],
    [KEYS.NOTIFICATIONS, JSON.stringify(notifications)],
    [KEYS.PRs, JSON.stringify(prs)],
  ]);
}

export function createSampleProgram(coachId: string): Omit<Program, 'id' | 'createdAt' | 'shareCode'> {
  const exercises = [
    { name: 'Squat', repsSets: '5x5', weight: '', rpe: '7' },
    { name: 'Bench Press', repsSets: '4x8', weight: '', rpe: '7' },
    { name: 'Barbell Row', repsSets: '4x8', weight: '', rpe: '7' },
    { name: 'Overhead Press', repsSets: '3x10', weight: '', rpe: '6' },
    { name: 'Deadlift', repsSets: '3x5', weight: '', rpe: '8' },
    { name: 'Pull-ups', repsSets: '3x8', weight: 'BW', rpe: '7' },
    { name: 'Lunges', repsSets: '3x10', weight: '', rpe: '6' },
    { name: 'Dips', repsSets: '3x10', weight: 'BW', rpe: '7' },
  ];

  const weeks: WorkoutWeek[] = [];
  for (let w = 1; w <= 4; w++) {
    const days: WorkoutDay[] = [];
    for (let d = 1; d <= 3; d++) {
      const dayExercises: Exercise[] = [];
      const startIdx = ((d - 1) * 3) % exercises.length;
      for (let e = 0; e < 3; e++) {
        const ex = exercises[(startIdx + e) % exercises.length];
        dayExercises.push({
          id: Crypto.randomUUID(),
          name: ex.name,
          weight: ex.weight,
          repsSets: ex.repsSets,
          rpe: ex.rpe,
          isCompleted: false,
          notes: '',
          clientNotes: '',
          coachComment: '',
          videoUrl: '',
        });
      }
      days.push({ dayNumber: d, exercises: dayExercises });
    }
    weeks.push({ weekNumber: w, days });
  }

  return {
    title: 'Strength Foundations',
    description: '4-week beginner strength program',
    weeks,
    daysPerWeek: 3,
    coachId,
    clientId: null,
    status: 'active',
  };
}
