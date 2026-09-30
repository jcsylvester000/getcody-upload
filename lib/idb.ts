"use client";
// Minimal IndexedDB store so the queue (and the files themselves) survive a page refresh.
// Everything stays in this browser only.

const DB = "grid-cody-uploader";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: "kv" | "files", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r ? (r.result as T) : undefined);
    t.onerror = () => reject(t.error);
  });
}

const safe = async <T>(p: Promise<T>) => {
  try {
    return await p;
  } catch {
    return undefined; // private mode / blocked storage: app still works, just without persistence
  }
};

export const idb = {
  get: <T>(key: string) => safe(tx<T>("kv", "readonly", (s) => s.get(key) as IDBRequest<T>)),
  set: (key: string, value: unknown) => safe(tx("kv", "readwrite", (s) => void s.put(value, key))),
  getFile: (id: string) => safe(tx<File>("files", "readonly", (s) => s.get(id) as IDBRequest<File>)),
  putFile: (id: string, file: File) => safe(tx("files", "readwrite", (s) => void s.put(file, id))),
  delFile: (id: string) => safe(tx("files", "readwrite", (s) => void s.delete(id))),
  fileKeys: () => safe(tx<IDBValidKey[]>("files", "readonly", (s) => s.getAllKeys())),
};
