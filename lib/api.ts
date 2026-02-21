import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = 'liftflow_auth_token';

function getBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN || '';
  if (domain) {
    const cleaned = domain.replace(/:\d+$/, '');
    return `https://${cleaned}`;
  }
  return 'http://localhost:5000';
}

const BASE = getBaseUrl();

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const authHeaders = await getAuthHeaders();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { ...authHeaders },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  } catch (e: any) {
    if (e instanceof TypeError || (e.message && (e.message.includes('Network request failed') || e.message.includes('Failed to fetch')))) {
      throw new Error('Unable to connect. Please check your internet connection.');
    }
    throw e;
  }
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const authHeaders = await getAuthHeaders();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  } catch (e: any) {
    if (e instanceof TypeError || (e.message && (e.message.includes('Network request failed') || e.message.includes('Failed to fetch')))) {
      throw new Error('Unable to connect. Please check your internet connection.');
    }
    throw e;
  }
}

export async function apiPut<T>(path: string, body?: any): Promise<T> {
  const authHeaders = await getAuthHeaders();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  } catch (e: any) {
    if (e instanceof TypeError || (e.message && (e.message.includes('Network request failed') || e.message.includes('Failed to fetch')))) {
      throw new Error('Unable to connect. Please check your internet connection.');
    }
    throw e;
  }
}

export async function apiDelete(path: string): Promise<void> {
  const authHeaders = await getAuthHeaders();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
  } catch (e: any) {
    if (e instanceof TypeError || (e.message && (e.message.includes('Network request failed') || e.message.includes('Failed to fetch')))) {
      throw new Error('Unable to connect. Please check your internet connection.');
    }
    throw e;
  }
}

export async function uploadVideo(uri: string, meta?: { programId: string; exerciseId: string; uploadedBy: string; coachId: string }): Promise<string> {
  const formData = new FormData();
  const authHeaders = await getAuthHeaders();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append('video', blob, 'video.mp4');
  } else {
    formData.append('video', {
      uri,
      type: 'video/mp4',
      name: 'video.mp4',
    } as any);
  }

  if (meta) {
    formData.append('programId', meta.programId);
    formData.append('exerciseId', meta.exerciseId);
    formData.append('uploadedBy', meta.uploadedBy);
    formData.append('coachId', meta.coachId);
  }

  const res = await fetch(`${BASE}/api/upload-video`, {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return `${BASE}${data.videoUrl}`;
}

export function getVideoUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export function getAvatarUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export async function uploadAvatar(profileId: string, uri: string): Promise<string> {
  const formData = new FormData();
  const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append('avatar', blob, `avatar.${ext}`);
  } else {
    formData.append('avatar', {
      uri,
      name: `avatar.${ext}`,
      type: mimeType,
    } as any);
  }

  formData.append('profileId', profileId);
  const token = await getAuthToken();
  const res = await fetch(`${BASE}/api/upload-avatar`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Upload failed');
  }
  const data = await res.json();
  return data.avatarUrl;
}

export async function deleteAvatar(profileId: string): Promise<void> {
  await apiDelete(`/api/avatar/${profileId}`);
}

export async function markVideoViewed(videoUrl: string): Promise<void> {
  const filename = videoUrl.split('/').pop();
  if (!filename) return;
  try {
    await apiPost(`/api/videos/${filename}/viewed`, {});
  } catch {}
}
