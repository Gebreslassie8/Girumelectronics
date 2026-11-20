// lib/notificationsStore.js
// Global unread-count store. No React context needed.

let state = { unread: 0 };
const listeners = new Set();

export const notificationsStore = {
  get() {
    return state;
  },

  set(patch) {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn(state));
  },

  setUnread(n) {
    const value = Math.max(0, Number(n) || 0);
    state = { ...state, unread: value };
    listeners.forEach((fn) => fn(state));
  },

  increment(by = 1) {
    state = { ...state, unread: state.unread + by };
    listeners.forEach((fn) => fn(state));
  },

  decrement(by = 1) {
    state = { ...state, unread: Math.max(0, state.unread - by) };
    listeners.forEach((fn) => fn(state));
  },

  reset() {
    state = { unread: 0 };
    listeners.forEach((fn) => fn(state));
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};