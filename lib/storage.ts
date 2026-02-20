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

const KEYS = {
  PRs: 'liftflow_prs',
  PROGRAMS: 'liftflow_programs',
  PROFILE: 'liftflow_profile',
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

export function getBestPR(prs: LiftPR[], liftType: string): LiftPR | null {
  const filtered = prs.filter(p => p.liftType === liftType);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, curr) => curr.weight > best.weight ? curr : best);
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
