import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from 'expo-constants';

const AUTH_TOKEN_KEY = 'liftflow_auth_token';

function getBaseUrl(): string {
  if (Platform.OS === 'web') {
    return '';
  }

  return 'https://new-liftflow-for-render-hosting-backend.onrender.com';
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

const isExpoGo = Constants.appOwnership === 'expo';

async function tryNativeCompress(uri: string): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    const { Video } = require('react-native-compressor');
    const result = await Video.compress(uri, {
      compressionMethod: 'manual',
      bitrate: 2000000,
      maxSize: 720,
    });
    return result;
  } catch {
    return null;
  }
}

function adaptiveBitrate(durationSeconds: number): number {
  if (durationSeconds <= 10) return 1000000;
  if (durationSeconds <= 20) return 1200000;
  if (durationSeconds <= 35) return 1500000;
  return 1800000;
}

async function tryLocalTrimAndCompress(uri: string, startTime: number, endTime: number): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web') return null;
  if (!Number.isFinite(endTime) || endTime <= startTime) return null;
  try {
    const { Video } = require('react-native-compressor');
    const duration = endTime - startTime;
    const result = await Video.compress(uri, {
      compressionMethod: 'manual',
      bitrate: adaptiveBitrate(duration),
      maxSize: 720,
      startTime,
      endTime,
    });
    return result;
  } catch (e) {
    console.warn('[trim] local trim+compress failed:', e);
    return null;
  }
}

async function tryLocalTrimOnly(uri: string, startTime: number, endTime: number): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web') return null;
  if (!Number.isFinite(endTime) || endTime <= startTime) return null;
  try {
    const { Video } = require('react-native-compressor');
    const result = await Video.compress(uri, {
      compressionMethod: 'auto',
      startTime,
      endTime,
    });
    return result;
  } catch (e) {
    console.warn('[trim] local trim-only failed:', e);
    return null;
  }
}

async function tryLocalCompress(uri: string, durationSeconds: number): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web') return null;
  try {
    const { Video } = require('react-native-compressor');
    const result = await Video.compress(uri, {
      compressionMethod: 'manual',
      bitrate: adaptiveBitrate(durationSeconds),
      maxSize: 720,
    });
    return result;
  } catch {
    return null;
  }
}

function uploadBlobWithProgress(url: string, blob: Blob, onProgress?: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'video/mp4');
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Map XHR progress (0→1) to the 0→90% band of the overall progress
          onProgress((e.loaded / e.total) * 0.9);
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Video upload failed (${xhr.status}). Please check your connection and try again.`));
      }
    };
    xhr.onerror = () => reject(new Error('Video upload failed. Please check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    xhr.send(blob);
  });
}

async function retryFetch(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res;
      lastError = new Error(`Server error: ${res.status}`);
    } catch (e: any) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('Upload failed after retries');
}

export async function uploadVideo(uri: string, meta?: { programId: string; exerciseId: string; uploadedBy: string; coachId: string }, trim?: { startTime: number; endTime: number }, onProgress?: (progress: number) => void): Promise<string> {
  const { getIsOnline } = require('./sync-manager');
  if (!getIsOnline()) {
    throw new Error('Video upload requires an internet connection. Please try again when connected.');
  }

  const authHeaders = await getAuthHeaders();

  if (Platform.OS === 'web') {
    return uploadVideoLegacy(uri, meta, trim);
  }

  let uploadUri = uri;
  let serverTrim: typeof trim = undefined;

  // Start fetching the signed upload URL immediately — it has no dependency
  // on local compression, so run both in parallel to hide the round-trip latency.
  const uploadUrlPromise = retryFetch(`${BASE}/api/video-upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
  });

  if (trim) {
    console.log(`[upload] trim requested: ${trim.startTime}s - ${trim.endTime}s (${(trim.endTime - trim.startTime).toFixed(1)}s clip), isExpoGo=${isExpoGo}`);
    const localResult = await tryLocalTrimAndCompress(uri, trim.startTime, trim.endTime);
    if (localResult) {
      console.log('[upload] local trim+compress succeeded');
      uploadUri = localResult;
    } else {
      console.log('[upload] local trim+compress failed, trying trim-only...');
      const trimOnly = await tryLocalTrimOnly(uri, trim.startTime, trim.endTime);
      if (trimOnly) {
        console.log('[upload] local trim-only succeeded');
        uploadUri = trimOnly;
      } else {
        console.log('[upload] all local trim methods failed, falling back to server-side trim');
        serverTrim = trim;
        const keptDuration = trim.endTime - trim.startTime;
        if (keptDuration > 30) {
          const compressed = await tryLocalCompress(uri, keptDuration);
          if (compressed) uploadUri = compressed;
        }
      }
    }
  } else {
    // No trim — just compress.
    const compressed = await tryNativeCompress(uri);
    if (compressed) uploadUri = compressed;
  }

  // By now compression is done — await the URL (likely already resolved).
  const urlRes = await uploadUrlPromise;
  if (!urlRes.ok) throw new Error('Failed to get upload URL. Check your connection and try again.');
  const { uploadUrl, filename, videoUrl } = await urlRes.json();

  const response = await fetch(uploadUri);
  const videoBlob = await response.blob();

  await uploadBlobWithProgress(uploadUrl, videoBlob, onProgress);
  // Signal upload to R2 is complete (registration still to go)
  onProgress?.(0.92);

  let finalFilename = filename;
  let finalVideoUrl = videoUrl;

  if (serverTrim) {
    try {
      const trimRes = await retryFetch(`${BASE}/api/trim-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ filename, startTime: serverTrim.startTime, endTime: serverTrim.endTime }),
      });
      if (trimRes.ok) {
        const trimData = await trimRes.json();
        finalFilename = trimData.filename;
        finalVideoUrl = trimData.videoUrl;
      } else {
        console.warn('[trim] server-side trim failed:', trimRes.status);
      }
    } catch (e) {
      console.warn('[trim] server-side trim error:', e);
    }
  }

  if (meta) {
    await retryFetch(`${BASE}/api/register-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        filename: finalFilename,
        programId: meta.programId,
        exerciseId: meta.exerciseId,
        uploadedBy: meta.uploadedBy,
        coachId: meta.coachId,
      }),
    });
  }

  return finalVideoUrl;
}

async function uploadVideoLegacy(uri: string, meta?: { programId: string; exerciseId: string; uploadedBy: string; coachId: string }, trim?: { startTime: number; endTime: number }): Promise<string> {
  const formData = new FormData();
  const authHeaders = await getAuthHeaders();

  const response = await fetch(uri);
  const blob = await response.blob();
  formData.append('video', blob, 'video.mp4');

  if (meta) {
    formData.append('programId', meta.programId);
    formData.append('exerciseId', meta.exerciseId);
    formData.append('uploadedBy', meta.uploadedBy);
    formData.append('coachId', meta.coachId);
  }

  if (trim) {
    formData.append('trimStart', String(trim.startTime));
    formData.append('trimEnd', String(trim.endTime));
  }

  const res = await fetch(`${BASE}/api/upload-video`, {
    method: 'POST',
    headers: { ...authHeaders },
    body: formData,
  });

  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.videoUrl;
}

export function getVideoUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${BASE}${path}`;
}

export async function getDirectVideoUrl(videoPath: string): Promise<string> {
  let filename = videoPath;
  if (filename.includes('/api/videos/')) {
    filename = filename.split('/api/videos/').pop() || filename;
  } else if (filename.startsWith('http')) {
    const parts = filename.split('/api/videos/');
    filename = parts.length > 1 ? parts[1] : filename.split('/').pop() || filename;
  }
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/videos/${filename}`, {
    headers: { ...authHeaders },
  });
  if (!res.ok) throw new Error('Video not found');
  const data = await res.json();
  return data.url;
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
