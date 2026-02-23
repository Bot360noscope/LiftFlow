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

export type LatestMessages = Record<string, { text: string; senderRole: string; createdAt: string }>;

const PROFILE_ID_KEY = 'liftflow_profile_id';
const CACHE_KEY = 'liftflow_cache_v2';

const cache: {
  profile: UserProfile | null;
  programs: Program[];
  prs: LiftPR[];
  clients: ClientInfo[];
  notifications: AppNotification[];
  latestMessages: LatestMessages;
  profileFetchedAt: number;
  programsFetchedAt: number;
  prsFetchedAt: number;
  clientsFetchedAt: number;
  notificationsFetchedAt: number;
  loaded: boolean;
} = {
  profile: null,
  programs: [],
  prs: [],
  clients: [],
  notifications: [],
  latestMessages: {},
  profileFetchedAt: 0,
  programsFetchedAt: 0,
  prsFetchedAt: 0,
  clientsFetchedAt: 0,
  notificationsFetchedAt: 0,
  loaded: false,
};

const STALE_MS = 10000;

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < STALE_MS;
}

let profileInflight: Promise<UserProfile> | null = null;

function persistCache() {
  const data = {
    profile: cache.profile,
    programs: cache.programs,
    prs: cache.prs,
    clients: cache.clients,
    notifications: cache.notifications,
    latestMessages: cache.latestMessages,
  };
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
}

export async function loadCacheFromDisk(): Promise<void> {
  if (cache.loaded) return;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.profile) cache.profile = data.profile;
      if (data.programs?.length) cache.programs = data.programs;
      if (data.prs?.length) cache.prs = data.prs;
      if (data.clients?.length) cache.clients = data.clients;
      if (data.notifications?.length) cache.notifications = data.notifications;
      if (data.latestMessages) cache.latestMessages = data.latestMessages;
    }
  } catch {}
  cache.loaded = true;
}

export function getCachedProfile(): UserProfile | null { return cache.profile; }
export function getCachedPrograms(): Program[] { return cache.programs; }
export function getCachedPRs(): LiftPR[] { return cache.prs; }
export function getCachedClients(): ClientInfo[] { return cache.clients; }
export function getCachedNotifications(): AppNotification[] { return cache.notifications; }
export function getCachedLatestMessages(): LatestMessages { return cache.latestMessages; }
export function isCacheLoaded(): boolean { return cache.loaded; }

export function clearCache() {
  cache.profile = null;
  cache.programs = [];
  cache.prs = [];
  cache.clients = [];
  cache.notifications = [];
  cache.latestMessages = {};
  cache.profileFetchedAt = 0;
  cache.programsFetchedAt = 0;
  cache.prsFetchedAt = 0;
  cache.clientsFetchedAt = 0;
  cache.notificationsFetchedAt = 0;
  cache.loaded = false;
  profileInflight = null;
  AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

async function requireProfileId(): Promise<string> {
  if (cache.profile) return cache.profile.id;
  const storedId = await getProfileId();
  if (storedId) return storedId;
  const p = await getProfile();
  return p.id;
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
    planUserLimit: profile.plan_user_limit != null ? profile.plan_user_limit : (profile.planUserLimit != null ? profile.planUserLimit : 1),
  };
}

export async function getProfile(): Promise<UserProfile> {
  if (cache.profile && isFresh(cache.profileFetchedAt)) return cache.profile;
  if (profileInflight) return profileInflight;
  profileInflight = _fetchProfile();
  try {
    return await profileInflight;
  } finally {
    profileInflight = null;
  }
}

async function _fetchProfile(): Promise<UserProfile> {
  const storedId = await getProfileId();
  if (storedId) {
    try {
      const result = mapProfile(await apiGet<any>(`/api/profiles/${storedId}`));
      cache.profile = result;
      cache.profileFetchedAt = Date.now();
      persistCache();
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
  cache.profileFetchedAt = Date.now();
  persistCache();
  return result;
}

export function invalidateProfileCache() {
  cache.profileFetchedAt = 0;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  cache.profile = profile;
  cache.profileFetchedAt = Date.now();
  persistCache();
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
  const profileId = await requireProfileId();
  const data = await apiGet<any[]>(`/api/programs?profileId=${profileId}`);
  const result = data.map(mapProgram);
  cache.programs = result;
  cache.programsFetchedAt = Date.now();
  persistCache();
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
  const profileId = await requireProfileId();
  const data = await apiGet<any[]>(`/api/prs?profileId=${profileId}`);
  const result = data.map(p => ({
    id: p.id,
    liftType: (p.liftType || p.lift_type) as 'squat' | 'deadlift' | 'bench',
    weight: p.weight,
    unit: p.unit as 'kg' | 'lbs',
    date: p.date,
    notes: p.notes,
  }));
  cache.prs = result;
  cache.prsFetchedAt = Date.now();
  persistCache();
  return result;
}

export async function addPR(pr: Omit<LiftPR, 'id'>): Promise<LiftPR> {
  const profileId = await requireProfileId();
  const result = await apiPost<any>('/api/prs', {
    profileId,
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
  const profileId = await requireProfileId();
  const data = await apiGet<any[]>(`/api/clients?coachId=${profileId}`);
  const result = data.map(c => ({
    id: c.id,
    name: c.name,
    joinedAt: c.joinedAt || c.joined_at,
    clientProfileId: c.clientProfileId || c.client_profile_id,
    avatarUrl: c.avatarUrl || c.avatar_url || '',
  }));
  cache.clients = result;
  cache.clientsFetchedAt = Date.now();
  persistCache();
  return result;
}

export async function joinCoach(code: string): Promise<{ coach: { id: string; name: string }; client: any }> {
  const profile = cache.profile || await getProfile();
  return apiPost('/api/join-coach', {
    code,
    clientProfileId: profile.id,
    clientName: profile.name || 'Client',
  });
}

export async function addClient(client: Omit<ClientInfo, 'joinedAt'>): Promise<void> {
  const profileId = await requireProfileId();
  await apiPost('/api/clients', {
    coachId: profileId,
    clientProfileId: client.clientProfileId || client.id,
    name: client.name,
  });
}

export async function removeClient(clientId: string): Promise<void> {
  const profileId = await requireProfileId();
  await apiPost('/api/remove-client', { coachId: profileId, clientId });
}

export async function getNotifications(): Promise<AppNotification[]> {
  const profileId = await requireProfileId();
  const data = await apiGet<any[]>(`/api/notifications?profileId=${profileId}`);
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
  cache.notificationsFetchedAt = Date.now();
  persistCache();
  return result;
}

export async function addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { targetProfileId?: string }): Promise<void> {
  const profileId = await requireProfileId();
  await apiPost('/api/notifications', {
    profileId: notification.targetProfileId || profileId,
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
  const profileId = await requireProfileId();
  await apiPut(`/api/notifications/read-all?profileId=${profileId}`);
}

export async function clearAllNotifications(): Promise<void> {
  const profileId = await requireProfileId();
  await apiDelete(`/api/notifications?profileId=${profileId}`);
}

export async function deleteNotification(id: string): Promise<void> {
  await apiDelete(`/api/notifications/${id}`);
}

export async function deleteNotificationsByProgram(programId: string): Promise<void> {
  const profileId = await requireProfileId();
  await apiDelete(`/api/notifications/by-program/${programId}?profileId=${profileId}`);
}

export async function markNotificationsReadByProgram(programId: string): Promise<void> {
  const profileId = await requireProfileId();
  await apiPut(`/api/notifications/read-by-program/${programId}?profileId=${profileId}`);
}

export async function getUnreadNotificationCount(): Promise<number> {
  if (cache.notifications.length > 0 && isFresh(cache.notificationsFetchedAt)) {
    return cache.notifications.filter(n => !n.read).length;
  }
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
  const role = cache.profile?.role || (await getProfile()).role;
  const msg = await apiPost<any>('/api/messages', {
    coachId,
    clientProfileId,
    senderRole: role,
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
  const profileId = await requireProfileId();
  const data = await apiGet<any>(`/api/my-coach?clientProfileId=${profileId}`);
  if (!data) return null;
  return { coachId: data.coachId || data.coach_id, coachName: data.coachName || data.coach_name || 'Coach' };
}

export async function leaveCoach(): Promise<void> {
  const profileId = await requireProfileId();
  await apiPost('/api/leave-coach', { clientProfileId: profileId });
}

export async function getLatestMessages(): Promise<LatestMessages> {
  const profileId = await requireProfileId();
  return apiGet<LatestMessages>(`/api/messages/latest?coachId=${profileId}`);
}

export interface DashboardData {
  profile: UserProfile;
  programs: Program[];
  prs: LiftPR[];
  notifications: AppNotification[];
  clients: ClientInfo[];
  latestMessages: LatestMessages;
}

export async function getDashboard(): Promise<DashboardData> {
  const profileId = await requireProfileId();
  const data = await apiGet<any>(`/api/dashboard?profileId=${profileId}`);
  const profile = mapProfile(data.profile);
  cache.profile = profile;
  cache.profileFetchedAt = Date.now();
  const progs = (data.programs || []).map(mapProgram);
  cache.programs = progs;
  cache.programsFetchedAt = Date.now();
  const prData = (data.prs || []).map((p: any) => ({
    id: p.id,
    liftType: (p.liftType || p.lift_type) as 'squat' | 'deadlift' | 'bench',
    weight: p.weight,
    unit: p.unit || 'kg',
    date: p.date,
    notes: p.notes || '',
  }));
  cache.prs = prData;
  cache.prsFetchedAt = Date.now();
  const notifs = (data.notifications || []).map((n: any) => ({
    id: n.id,
    type: n.type as AppNotification['type'],
    title: n.title,
    message: n.message,
    read: n.read ?? n.is_read ?? false,
    createdAt: n.createdAt || n.created_at,
    programId: n.programId || n.program_id,
    programTitle: n.programTitle || n.program_title,
    exerciseName: n.exerciseName || n.exercise_name,
    fromRole: n.fromRole || n.from_role,
  }));
  cache.notifications = notifs;
  cache.notificationsFetchedAt = Date.now();
  const cls = (data.clients || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    joinedAt: c.joinedAt || c.joined_at,
    clientProfileId: c.clientProfileId || c.client_profile_id,
    avatarUrl: c.avatarUrl || c.avatar_url || '',
  }));
  cache.clients = cls;
  cache.clientsFetchedAt = Date.now();
  cache.latestMessages = data.latestMessages || {};
  persistCache();
  return {
    profile,
    programs: progs,
    prs: prData,
    notifications: notifs,
    clients: cls,
    latestMessages: cache.latestMessages,
  };
}

export async function searchClients(query: string): Promise<ClientInfo[]> {
  const profileId = await requireProfileId();
  const data = await apiGet<any[]>(`/api/clients/search?coachId=${profileId}&q=${encodeURIComponent(query)}`);
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
