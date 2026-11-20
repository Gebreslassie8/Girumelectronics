// lib/api.js
import { enqueue } from './offlineQueue';
import { openDB } from 'idb';

const API = '/api';

async function cacheSet(key, data) {
  const db = await openDB('grum-cache', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('json')) {
        db.createObjectStore('json');
      }
    },
  });
  await db.put('json', { data, at: Date.now() }, key);
}

async function cacheGet(key) {
  const db = await openDB('grum-cache', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('json')) {
        db.createObjectStore('json');
      }
    },
  });
  const row = await db.get('json', key);
  return row?.data;
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    if (!isMutation) await cacheSet(url, data);
    return data;
  } catch (err) {
    if (!isMutation) {
      const cached = await cacheGet(url);
      if (cached) return cached;
    }

    if (isMutation && typeof window !== 'undefined' && !navigator.onLine) {
      await enqueue({
        url,
        method,
        body: options.body ? JSON.parse(options.body) : undefined,
        headers: options.headers || {},
      });
      return {
        queued: true,
        message: 'ከመስመር ውጭ ነዎት — ይህ ጥያቄ በበኋላ ይላካል።',
      };
    }

    throw err;
  }
}