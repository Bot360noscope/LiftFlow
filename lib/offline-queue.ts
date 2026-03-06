import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'liftflow_offline_queue';

export interface QueueEntry {
  id: string;
  type: 'updateProgram' | 'addPR' | 'deletePR' | 'sendMessage' | 'updateProfile' | 'deleteProgram';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: number;
  retries?: number;
}

const MAX_RETRIES = 5;

let queue: QueueEntry[] = [];
let loaded = false;

async function loadQueue(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) queue = JSON.parse(raw);
  } catch {}
  loaded = true;
}

async function saveQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function enqueue(entry: Omit<QueueEntry, 'id' | 'timestamp'>): Promise<void> {
  await loadQueue();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  queue.push({ ...entry, id, timestamp: Date.now() });
  await saveQueue();
}

export async function dequeue(id: string): Promise<void> {
  await loadQueue();
  queue = queue.filter(e => e.id !== id);
  await saveQueue();
}

export async function getQueue(): Promise<QueueEntry[]> {
  await loadQueue();
  return [...queue];
}

export async function getPendingCount(): Promise<number> {
  await loadQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  queue = [];
  loaded = true;
  await saveQueue();
}

export async function flushQueue(
  executor: (entry: QueueEntry) => Promise<boolean>
): Promise<{ succeeded: number; failed: number }> {
  await loadQueue();
  let succeeded = 0;
  let failed = 0;
  const remaining: QueueEntry[] = [];

  const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp);

  for (const entry of sorted) {
    try {
      const ok = await executor(entry);
      if (ok) {
        succeeded++;
      } else {
        const retries = (entry.retries || 0) + 1;
        if (retries < MAX_RETRIES) {
          remaining.push({ ...entry, retries });
        }
        failed++;
      }
    } catch {
      const retries = (entry.retries || 0) + 1;
      if (retries < MAX_RETRIES) {
        remaining.push({ ...entry, retries });
      }
      failed++;
    }
  }

  queue = remaining;
  await saveQueue();
  return { succeeded, failed };
}
