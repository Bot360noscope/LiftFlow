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
}

interface UploadContextValue {
  uploads: PendingUpload[];
  addUpload: (upload: Omit<PendingUpload, 'status'>) => void;
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

  const sync = (updated: PendingUpload[]) => {
    uploadsRef.current = updated;
    setUploads([...updated]);
  };

  const processNext = useCallback(async () => {
    if (processingRef.current) return;
    const next = uploadsRef.current.find(u => u.status === 'pending');
    if (!next) return;

    processingRef.current = true;
    sync(uploadsRef.current.map(u => u.id === next.id ? { ...u, status: 'uploading' } : u));

    try {
      const videoUrl = await uploadVideo(next.uri, next.meta, next.trim);
      trimResult.videoUrl = videoUrl;
      trimResult.exerciseId = next.meta.exerciseId;

      sync(uploadsRef.current.map(u => u.id === next.id ? { ...u, status: 'done' } : u));

      setTimeout(() => {
        sync(uploadsRef.current.filter(u => u.id !== next.id));
      }, 4000);
    } catch {
      sync(uploadsRef.current.map(u => u.id === next.id ? { ...u, status: 'error' } : u));
    } finally {
      processingRef.current = false;
      processNext();
    }
  }, []);

  const addUpload = useCallback((upload: Omit<PendingUpload, 'status'>) => {
    const item: PendingUpload = { ...upload, status: 'pending' };
    const updated = [...uploadsRef.current, item];
    sync(updated);
    setTimeout(processNext, 0);
  }, [processNext]);

  const retryUpload = useCallback((id: string) => {
    sync(uploadsRef.current.map(u => u.id === id ? { ...u, status: 'pending' } : u));
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
