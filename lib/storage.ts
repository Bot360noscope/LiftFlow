import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface CellData {
  cellId: string;
  exerciseName: string;
  weight: string;
  repsSets: string;
  rpe: string;
  videoUrl: string;
  isCompleted: boolean;
  clientNotes: string;
  coachComment: string;
  completedAt: string | null;
}

export interface Program {
  id: string;
  title: string;
  description: string;
  totalWeeks: number;
  daysPerWeek: number;
  rowCount: number;
  cells: Record<string, CellData>;
  shareCode: string;
  coachId: string;
  clientId: string | null;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
}

export interface LiftPR {
  id: string;
  liftType: 'squat' | 'deadlift' | 'bench';
  weight: number;
  unit: 'kg' | 'lbs';
  date: string;
  notes: string;
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

export function cellKey(rowIdx: number, weekNum: number, dayNum: number): string {
  return `${rowIdx}-${weekNum}-${dayNum}`;
}

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getProfile(): Promise<UserProfile> {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  if (data) return JSON.parse(data);
  const defaultProfile: UserProfile = {
    id: Crypto.randomUUID(),
    name: '',
    role: 'coach',
    weightUnit: 'kg',
    coachCode: generateCode(),
  };
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(defaultProfile));
  return defaultProfile;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
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
  await AsyncStorage.setItem(KEYS.PRs, JSON.stringify(prs.filter(pr => pr.id !== id)));
}

export async function getPrograms(): Promise<Program[]> {
  const data = await AsyncStorage.getItem(KEYS.PROGRAMS);
  if (!data) return [];
  const parsed = JSON.parse(data);
  const valid = parsed.filter((p: any) => p.cells && typeof p.cells === 'object');
  if (valid.length !== parsed.length) {
    await AsyncStorage.setItem(KEYS.PROGRAMS, JSON.stringify(valid));
  }
  return valid;
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
  await AsyncStorage.setItem(KEYS.PROGRAMS, JSON.stringify(programs.filter(p => p.id !== id)));
}

export function getBestPR(prs: LiftPR[], liftType: string): LiftPR | null {
  const filtered = prs.filter(p => p.liftType === liftType);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, curr) => curr.weight > best.weight ? curr : best);
}

export function getEmptyCell(rowIdx: number, weekNum: number, dayNum: number): CellData {
  return {
    cellId: `${rowIdx}-${weekNum}-${dayNum}`,
    exerciseName: '',
    weight: '',
    repsSets: '',
    rpe: '',
    videoUrl: '',
    isCompleted: false,
    clientNotes: '',
    coachComment: '',
    completedAt: null,
  };
}

export function createSampleProgram(coachId: string): Omit<Program, 'id' | 'createdAt' | 'shareCode'> {
  const exerciseTemplates = [
    { name: 'Squat', rx: '5x5' },
    { name: 'Bench Press', rx: '4x8' },
    { name: 'Barbell Row', rx: '4x8' },
    { name: 'Overhead Press', rx: '3x10' },
    { name: 'Deadlift', rx: '3x5' },
    { name: 'Pull-ups', rx: '3x8' },
  ];

  const cells: Record<string, CellData> = {};
  const rowCount = exerciseTemplates.length;

  for (let row = 0; row < rowCount; row++) {
    for (let week = 1; week <= 4; week++) {
      for (let day = 1; day <= 3; day++) {
        const key = cellKey(row, week, day);
        cells[key] = {
          cellId: key,
          exerciseName: exerciseTemplates[row].name,
          weight: '',
          repsSets: exerciseTemplates[row].rx,
          rpe: '7',
          videoUrl: '',
          isCompleted: false,
          clientNotes: '',
          coachComment: '',
          completedAt: null,
        };
      }
    }
  }

  return {
    title: 'Strength Foundations',
    description: '4-week beginner strength program',
    totalWeeks: 4,
    daysPerWeek: 3,
    rowCount,
    cells,
    coachId,
    clientId: null,
    status: 'active',
  };
}
