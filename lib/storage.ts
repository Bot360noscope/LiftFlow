import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { apiGet, apiPost, apiPut, apiDelete, setAuthToken, clearAuthToken, getAuthToken } from './api';

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
  avatarUrl: string;
  plan: string;
  planUserLimit: number;
}

export interface ClientInfo {
  id: string;
  name: string;
  joinedAt: string;
  clientProfileId?: string;
  avatarUrl?: string;
}

export interface AppNotification {
  id: string;
  type: 'video' | 'notes' | 'comment' | 'completion' | 'chat';
  title: string;
  message: string;
  programId: string;
  programTitle: string;
  exerciseName: string;
  fromRole: 'coach' | 'client';
  createdAt: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  coachId: string;
  clientProfileId: string;
  senderRole: 'coach' | 'client';
  text: string;
  createdAt: string;
}

const PROFILE_ID_KEY = 'liftflow_profile_id';

const cache: {
  profile: UserProfile | null;
  programs: Program[];
  prs: LiftPR[];
  clients: ClientInfo[];
  notifications: AppNotification[];
} = {
  profile: null,
  programs: [],
  prs: [],
  clients: [],
  notifications: [],
};

export function getCachedProfile(): UserProfile | null { return cache.profile; }
export function getCachedPrograms(): Program[] { return cache.programs; }
export function getCachedPRs(): LiftPR[] { return cache.prs; }
export function getCachedClients(): ClientInfo[] { return cache.clients; }
export function getCachedNotifications(): AppNotification[] { return cache.notifications; }

export function clearCache() {
  cache.profile = null;
  cache.programs = [];
  cache.prs = [];
  cache.clients = [];
  cache.notifications = [];
}

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function getProfileId(): Promise<string | null> {
  return AsyncStorage.getItem(PROFILE_ID_KEY);
}

async function setProfileId(id: string): Promise<void> {
  await AsyncStorage.setItem(PROFILE_ID_KEY, id);
}

function mapProfile(profile: any): UserProfile {
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role as 'coach' | 'client',
    weightUnit: (profile.weightUnit || profile.weight_unit) as 'kg' | 'lbs',
    coachCode: profile.coachCode || profile.coach_code,
    avatarUrl: profile.avatarUrl || profile.avatar_url || '',
    plan: profile.plan || 'free',
    planUserLimit: profile.planUserLimit || profile.plan_user_limit || 1,
  };
}

export async function getProfile(): Promise<UserProfile> {
  const storedId = await getProfileId();
  if (storedId) {
    try {
      const result = mapProfile(await apiGet<any>(`/api/profiles/${storedId}`));
      cache.profile = result;
      return result;
    } catch {
    }
  }
  const profile = await apiPost<any>('/api/profiles', {
    name: '',
    role: 'client',
    weightUnit: 'kg',
  });
  await setProfileId(profile.id);
  const result = mapProfile(profile);
  cache.profile = result;
  return result;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  cache.profile = profile;
  await setProfileId(profile.id);
  await apiPut(`/api/profiles/${profile.id}`, {
    name: profile.name,
    role: profile.role,
    weightUnit: profile.weightUnit,
    coachCode: profile.coachCode,
  });
}

export async function resetCoachCode(): Promise<string> {
  const profile = await getProfile();
  const result = await apiPost<{ coachCode: string }>(`/api/profiles/${profile.id}/reset-code`);
  return result.coachCode || (result as any).coach_code;
}

function mapProgram(p: any): Program {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    weeks: p.weeks as WorkoutWeek[],
    createdAt: p.createdAt || p.created_at,
    daysPerWeek: p.daysPerWeek || p.days_per_week,
    shareCode: p.shareCode || p.share_code,
    coachId: p.coachId || p.coach_id,
    clientId: p.clientId || p.client_id || null,
    status: (p.status || 'active') as 'draft' | 'active' | 'completed',
  };
}

export async function getPrograms(): Promise<Program[]> {
  const profile = await getProfile();
  const data = await apiGet<any[]>(`/api/programs?profileId=${profile.id}`);
  const result = data.map(mapProgram);
  cache.programs = result;
  return result;
}

export async function getProgram(id: string): Promise<Program | null> {
  try {
    const p = await apiGet<any>(`/api/programs/${id}`);
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      weeks: p.weeks as WorkoutWeek[],
      createdAt: p.createdAt || p.created_at,
      daysPerWeek: p.daysPerWeek || p.days_per_week,
      shareCode: p.shareCode || p.share_code,
      coachId: p.coachId || p.coach_id,
      clientId: p.clientId || p.client_id || null,
      status: (p.status || 'active') as 'draft' | 'active' | 'completed',
    };
  } catch {
    return null;
  }
}

export async function addProgram(program: Omit<Program, 'id' | 'createdAt' | 'shareCode'>): Promise<Program> {
  const p = await apiPost<any>('/api/programs', {
    title: program.title,
    description: program.description,
    weeks: program.weeks,
    daysPerWeek: program.daysPerWeek,
    coachId: program.coachId,
    clientId: program.clientId,
    status: program.status,
  });
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    weeks: p.weeks as WorkoutWeek[],
    createdAt: p.createdAt || p.created_at,
    daysPerWeek: p.daysPerWeek || p.days_per_week,
    shareCode: p.shareCode || p.share_code,
    coachId: p.coachId || p.coach_id,
    clientId: p.clientId || p.client_id || null,
    status: (p.status || 'active') as 'draft' | 'active' | 'completed',
  };
}

export async function updateProgram(program: Program): Promise<void> {
  await apiPut(`/api/programs/${program.id}`, {
    title: program.title,
    description: program.description,
    weeks: program.weeks,
    daysPerWeek: program.daysPerWeek,
    clientId: program.clientId,
    status: program.status,
  });
}

export async function deleteProgram(id: string): Promise<void> {
  await apiDelete(`/api/programs/${id}`);
}

export async function getPRs(): Promise<LiftPR[]> {
  const profile = await getProfile();
  const data = await apiGet<any[]>(`/api/prs?profileId=${profile.id}`);
  const result = data.map(p => ({
    id: p.id,
    liftType: (p.liftType || p.lift_type) as 'squat' | 'deadlift' | 'bench',
    weight: p.weight,
    unit: p.unit as 'kg' | 'lbs',
    date: p.date,
    notes: p.notes,
  }));
  cache.prs = result;
  return result;
}

export async function addPR(pr: Omit<LiftPR, 'id'>): Promise<LiftPR> {
  const profile = await getProfile();
  const result = await apiPost<any>('/api/prs', {
    profileId: profile.id,
    liftType: pr.liftType,
    weight: pr.weight,
    unit: pr.unit,
    date: pr.date,
    notes: pr.notes,
  });
  return {
    id: result.id,
    liftType: (result.liftType || result.lift_type) as 'squat' | 'deadlift' | 'bench',
    weight: result.weight,
    unit: result.unit as 'kg' | 'lbs',
    date: result.date,
    notes: result.notes,
  };
}

export async function deletePR(id: string): Promise<void> {
  await apiDelete(`/api/prs/${id}`);
}

export function getBestPR(prs: LiftPR[], liftType: string): LiftPR | null {
  const filtered = prs.filter(p => p.liftType === liftType);
  if (filtered.length === 0) return null;
  return filtered.reduce((best, curr) => curr.weight > best.weight ? curr : best);
}

export async function getClients(): Promise<ClientInfo[]> {
  const profile = await getProfile();
  const data = await apiGet<any[]>(`/api/clients?coachId=${profile.id}`);
  const result = data.map(c => ({
    id: c.id,
    name: c.name,
    joinedAt: c.joinedAt || c.joined_at,
    clientProfileId: c.clientProfileId || c.client_profile_id,
  }));
  cache.clients = result;
  return result;
}

export async function joinCoach(code: string): Promise<{ coach: { id: string; name: string }; client: any }> {
  const profile = await getProfile();
  return apiPost('/api/join-coach', {
    code,
    clientProfileId: profile.id,
    clientName: profile.name || 'Client',
  });
}

export async function addClient(client: Omit<ClientInfo, 'joinedAt'>): Promise<void> {
  const profile = await getProfile();
  await apiPost('/api/clients', {
    coachId: profile.id,
    clientProfileId: client.clientProfileId || client.id,
    name: client.name,
  });
}

export async function removeClient(clientId: string): Promise<void> {
  const profile = await getProfile();
  await apiPost('/api/remove-client', { coachId: profile.id, clientId });
}

export async function getNotifications(): Promise<AppNotification[]> {
  const profile = await getProfile();
  const data = await apiGet<any[]>(`/api/notifications?profileId=${profile.id}`);
  const result = data.map(n => ({
    id: n.id,
    type: n.type as AppNotification['type'],
    title: n.title,
    message: n.message,
    programId: n.programId || n.program_id,
    programTitle: n.programTitle || n.program_title,
    exerciseName: n.exerciseName || n.exercise_name,
    fromRole: (n.fromRole || n.from_role) as 'coach' | 'client',
    createdAt: n.createdAt || n.created_at,
    read: n.read,
  }));
  cache.notifications = result;
  return result;
}

export async function addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { targetProfileId?: string }): Promise<void> {
  const profile = await getProfile();
  await apiPost('/api/notifications', {
    profileId: notification.targetProfileId || profile.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    programId: notification.programId,
    programTitle: notification.programTitle,
    exerciseName: notification.exerciseName,
    fromRole: notification.fromRole,
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiPut(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  const profile = await getProfile();
  await apiPut(`/api/notifications/read-all?profileId=${profile.id}`);
}

export async function clearAllNotifications(): Promise<void> {
  const profile = await getProfile();
  await apiDelete(`/api/notifications?profileId=${profile.id}`);
}

export async function deleteNotification(id: string): Promise<void> {
  await apiDelete(`/api/notifications/${id}`);
}

export async function deleteNotificationsByProgram(programId: string): Promise<void> {
  const profile = await getProfile();
  await apiDelete(`/api/notifications/by-program/${programId}?profileId=${profile.id}`);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const notifications = await getNotifications();
  return notifications.filter(n => !n.read).length;
}

export async function seedDemoData(): Promise<void> {
  const result = await apiPost<{ profileId: string }>('/api/seed-demo');
  await setProfileId(result.profileId);
}

export async function getMessages(coachId: string, clientProfileId: string): Promise<ChatMessage[]> {
  const data = await apiGet<any[]>(`/api/messages?coachId=${coachId}&clientProfileId=${clientProfileId}`);
  return data.map(m => ({
    id: m.id,
    coachId: m.coachId || m.coach_id,
    clientProfileId: m.clientProfileId || m.client_profile_id,
    senderRole: (m.senderRole || m.sender_role) as 'coach' | 'client',
    text: m.text,
    createdAt: m.createdAt || m.created_at,
  }));
}

export async function sendMessage(coachId: string, clientProfileId: string, text: string): Promise<ChatMessage> {
  const profile = await getProfile();
  const msg = await apiPost<any>('/api/messages', {
    coachId,
    clientProfileId,
    senderRole: profile.role,
    text,
  });
  return {
    id: msg.id,
    coachId: msg.coachId || msg.coach_id,
    clientProfileId: msg.clientProfileId || msg.client_profile_id,
    senderRole: (msg.senderRole || msg.sender_role) as 'coach' | 'client',
    text: msg.text,
    createdAt: msg.createdAt || msg.created_at,
  };
}

export async function register(email: string, password: string, name: string, role: 'coach' | 'client'): Promise<{ token: string; profile: UserProfile }> {
  const data = await apiPost<any>('/api/auth/register', { email, password, name, role });
  await setAuthToken(data.token);
  const profile = mapProfile(data.profile);
  await setProfileId(profile.id);
  return { token: data.token, profile };
}

export async function login(email: string, password: string): Promise<{ token: string; profile: UserProfile }> {
  const data = await apiPost<any>('/api/auth/login', { email, password });
  await setAuthToken(data.token);
  const profile = mapProfile(data.profile);
  await setProfileId(profile.id);
  return { token: data.token, profile };
}

export async function logout(): Promise<void> {
  clearCache();
  await clearAuthToken();
  await AsyncStorage.removeItem(PROFILE_ID_KEY);
}

export async function deleteAccount(confirmation: string): Promise<void> {
  await apiPost('/api/account/delete', { confirmation });
  clearCache();
  await clearAuthToken();
  await AsyncStorage.removeItem(PROFILE_ID_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

export async function getMyCoach(): Promise<{ coachId: string; coachName: string } | null> {
  const profile = await getProfile();
  const data = await apiGet<any>(`/api/my-coach?clientProfileId=${profile.id}`);
  if (!data) return null;
  return { coachId: data.coachId || data.coach_id, coachName: data.coachName || data.coach_name || 'Coach' };
}

export async function leaveCoach(): Promise<void> {
  const profile = await getProfile();
  await apiPost('/api/leave-coach', { clientProfileId: profile.id });
}

export type LatestMessages = Record<string, { text: string; senderRole: string; createdAt: string }>;

export async function getLatestMessages(): Promise<LatestMessages> {
  const profile = await getProfile();
  return apiGet<LatestMessages>(`/api/messages/latest?coachId=${profile.id}`);
}

export async function searchClients(query: string): Promise<ClientInfo[]> {
  const profile = await getProfile();
  const data = await apiGet<any[]>(`/api/clients/search?coachId=${profile.id}&q=${encodeURIComponent(query)}`);
  return data.map(c => ({
    id: c.id,
    name: c.name,
    joinedAt: c.joinedAt || c.joined_at,
    clientProfileId: c.clientProfileId || c.client_profile_id,
  }));
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
