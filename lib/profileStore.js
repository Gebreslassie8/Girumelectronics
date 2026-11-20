// lib/profileStore.js
// Tiny global store for profile state (avatar, name, etc.)

import { openDB } from 'idb';

const DB_NAME = 'grum-profile';
const STORE = 'profile';
const KEY = 'current';

let state = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  avatar: null,
  role: '',
  branch: null,
};

const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(state));
}

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
}

export const profileStore = {
  get() {
    return state;
  },

  set(patch) {
    state = { ...state, ...patch };
    notify();
    if (typeof window !== 'undefined') {
      getDB()
        .then((db) => db.put(STORE, state, KEY))
        .catch(() => {});
    }
  },

  reset() {
    state = {
      fullName: '',
      phone: '',
      email: '',
      address: '',
      avatar: null,
      role: '',
      branch: null,
    };
    notify();
    if (typeof window !== 'undefined') {
      getDB().then((db) => db.delete(STORE, KEY)).catch(() => {});
    }
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  async loadFromCache() {
    if (typeof window === 'undefined') return null;
    try {
      const db = await getDB();
      const cached = await db.get(STORE, KEY);
      if (cached) {
        state = { ...state, ...cached };
        notify();
        return state;
      }
    } catch {}
    return null;
  },
};