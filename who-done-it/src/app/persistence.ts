// Save storage over localStorage. docs/architecture.md section 4.
// Keys are prefixed "wdi:v1:"; every value is wrapped { v: 1, data }. A bad value is moved to
// "wdi:v1:quarantine:<key>" and treated as absent. Nothing here throws.

export interface SaveStore {
  /** The saved value for `key`, or undefined if absent, corrupt, of another version, or failing `validate`. */
  load<T>(key: string, validate?: (data: unknown) => boolean): T | undefined;
  /** Save a JSON-serialisable value under `key`. Failures (quota, disabled storage) are swallowed. */
  save(key: string, value: unknown): void;
  /** Delete the value under `key`. */
  remove(key: string): void;
}

export const PREFIX = "wdi:v1:";
const VERSION = 1;

interface Backend {
  get(k: string): string | null;
  set(k: string, v: string): void;
  del(k: string): void;
}

/** SaveStore over any string backend. If the backend throws, values live in an in-memory fallback. */
function makeStore(backend: Backend): SaveStore {
  const fallback = new Map<string, string>();
  const read = (k: string): string | null => {
    try {
      const v = backend.get(k);
      if (v !== null) return v;
    } catch {
      // storage unavailable
    }
    return fallback.get(k) ?? null;
  };
  const write = (k: string, v: string): void => {
    try {
      backend.set(k, v);
      fallback.delete(k);
    } catch {
      fallback.set(k, v);
    }
  };
  const del = (k: string): void => {
    fallback.delete(k);
    try {
      backend.del(k);
    } catch {
      // ignore
    }
  };
  const quarantine = (key: string, raw: string): void => {
    write(`${PREFIX}quarantine:${key}`, raw);
    del(PREFIX + key);
  };

  return {
    load<T>(key: string, validate?: (data: unknown) => boolean): T | undefined {
      const raw = read(PREFIX + key);
      if (raw === null) return undefined;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && (parsed as { v?: unknown }).v === VERSION && "data" in parsed) {
          const data = (parsed as { data: unknown }).data;
          if (!validate || validate(data)) return data as T;
        }
      } catch {
        // unparsable or validator threw
      }
      quarantine(key, raw);
      return undefined;
    },
    save(key, value) {
      try {
        write(PREFIX + key, JSON.stringify({ v: VERSION, data: value }));
      } catch {
        // unserialisable: ignore
      }
    },
    remove(key) {
      del(PREFIX + key);
    },
  };
}

/** SaveStore over window.localStorage (or a Storage you pass in). Falls back to memory if storage is unusable. */
export function localStorageStore(storage?: Storage): SaveStore {
  const get = (): Storage | undefined => {
    try {
      return storage ?? globalThis.localStorage;
    } catch {
      return undefined;
    }
  };
  return makeStore({
    get: (k) => {
      const s = get();
      if (!s) throw new Error("no storage");
      return s.getItem(k);
    },
    set: (k, v) => {
      const s = get();
      if (!s) throw new Error("no storage");
      s.setItem(k, v);
    },
    del: (k) => get()?.removeItem(k),
  });
}

/** In-memory SaveStore for tests. `raw` exposes the stored strings for inspection or corruption. */
export function memoryStore(raw: Map<string, string> = new Map()): SaveStore & { raw: Map<string, string> } {
  const store = makeStore({
    get: (k) => raw.get(k) ?? null,
    set: (k, v) => void raw.set(k, v),
    del: (k) => void raw.delete(k),
  });
  return Object.assign(store, { raw });
}
