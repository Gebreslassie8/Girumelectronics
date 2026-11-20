// lib/offlineQueue.js
import { openDB } from 'idb';

const DB_NAME = 'grum-offline';
const STORE = 'mutations';

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(mutation) {
  const db = await getDB();
  return db.add(STORE, {
    url: mutation.url,
    method: mutation.method || 'POST',
    body: mutation.body,
    headers: mutation.headers || {},
    createdAt: Date.now(),
  });
}

export async function getAll() {
  const db = await getDB();
  return db.getAll(STORE);
}

export async function remove(id) {
  const db = await getDB();
  return db.delete(STORE, id);
}

export async function clear() {
  const db = await getDB();
  return db.clear(STORE);
}

/**
 * Replay all queued mutations.
 * Returns { ok, failed } counts.
 */
export async function flush(onProgress) {
  const items = await getAll();
  let ok = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...item.headers,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
        credentials: 'include',
      });
      if (res.ok) {
        await remove(item.id);
        ok++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    onProgress?.({ ok, failed, total: items.length });
  }

  return { ok, failed };
}