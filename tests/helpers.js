// Test affordance: a Map-backed localStorage and a fetch that reads files from disk,
// so the real js/store.js runs under Node exactly as it does in the browser.
import { readFileSync } from 'node:fs';

class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
  clear() { this.#m.clear(); }
  key(i) { return [...this.#m.keys()][i] ?? null; }
  get length() { return this.#m.size; }
}

export const fetchCalls = { count: 0 };

export function installBrowserShims() {
  const storage = new MemoryStorage();
  // Object.keys(localStorage) in the browser lists the stored keys; mirror that with a Proxy.
  globalThis.localStorage = new Proxy(storage, {
    ownKeys: (t) => { const keys = []; for (let i = 0; i < t.length; i++) keys.push(t.key(i)); return keys; },
    getOwnPropertyDescriptor: (t, k) => (t.getItem(k) !== null ? { enumerable: true, configurable: true, value: t.getItem(k) } : undefined),
    get: (t, k) => { const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; },
  });
  globalThis.fetch = async (url) => {
    fetchCalls.count += 1;
    const body = readFileSync(new URL(url), 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body) };
  };
  return storage;
}
