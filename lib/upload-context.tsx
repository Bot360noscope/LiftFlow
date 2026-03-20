import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { uploadVideo } from './api';
import { trimResult } from './trim-result';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface PendingUpload {
  id: string;
  uri: string;
  meta: { programId: string; exerciseId: string; uploadedBy: string; coachId: string };
  trim?: { startTime: number; endTime: number };
  status: UploadStatus;
  exerciseName: string;
  progress: number;
}

interface UploadContextValue {
  uploads: PendingUpload[];
  addUpload: (upload: Omit<PendingUpload, 'status' | 'progress'>) => void;
  retryUpload: (id: string) => void;
  dismissUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextValue>({
  uploads: [],
  addUpload: () => {},
  retryUpload: () => {},
  dismissUpload: () => {},
});

export function useUploads() {
  return useContext(UploadContext);
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const processingRef = useRef(false);
  const uploadsRef = useRef<PendingUpload[]>([]);
  const lastProgressUpdateRef = useRef<number>(0);

  const sync = (updated: PendingUpload[]) => {
    uploadsRef.current = updated;
    setUploads([...updated]);
  };

  const updateProgress = useCallback((id: string, progress: number) => {
    const now = Date.now();
    // Throttle progress updates to ~10fps to avoid excessive re-renders
    if (now - lastProgressUpdateRef.current < 100) return;
    lastProgressUpdateRef.current = now;
    const updated = uploadsRef.current.map(u =>
      u.id === id ? { ...u, progress } : u
    );
    uploadsRef.current = updated;
    setUploads([...updated]);
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = uploadsRef.current.find(u => u.status === 'pending');
    if (!next) return;

    processingRef.current = true;
    sync(uploadsRef.current.map(u => u.id === next.id ? { ...u, status: 'uploading', progress: 0 } : u));

    try {
      const videoUrl = await uploadVideo(
        next.uri,
        next.meta,
        next.trim,
        (progress) => updateProgress(next.id, progress),
      );
      trimResult.videoUrl = videoUrl;
      trimResult.exerciseId = next.meta.exerciseId;

      sync(uploadsRef.current.map(u => u.id === next.id ? { ...u, status: 'done', progress: 1 } : u));

      setTimeout(() => {
        sync(uploadsRef.current.filter(u => u.id !== next.id));
      }, 4000);
    } catch {
      sync(uploadsRef.current.map(u => u.id === next.id ? { ...u, status: 'error', progress: 0 } : u));
    } finally {
      processingRef.current = false;
      processNext();
    }
  }, [updateProgress]);

  const addUpload = useCallback((upload: Omit<PendingUpload, 'status' | 'progress'>) => {
    const item: PendingUpload = { ...upload, status: 'pending', progress: 0 };
    const updated = [...uploadsRef.current, item];
    sync(updated);
    setTimeout(processNext, 0);
  }, [processNext]);

  const retryUpload = useCallback((id: string) => {
    sync(uploadsRef.current.map(u => u.id === id ? { ...u, status: 'pending', progress: 0 } : u));
    setTimeout(processNext, 0);
  }, [processNext]);

  const dismissUpload = useCallback((id: string) => {
    sync(uploadsRef.current.filter(u => u.id !== id));
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, addUpload, retryUpload, dismissUpload }}>
      {children}
    </UploadContext.Provider>
  );
}
