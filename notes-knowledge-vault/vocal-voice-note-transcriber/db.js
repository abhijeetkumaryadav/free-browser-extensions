/* VocalNote — shared IndexedDB helper (loaded by popup + offscreen).
 * Audio blobs are stored in IndexedDB, which persists after the popup closes.
 */
'use strict';

const DB_NAME = 'vocal-note-db';
const STORE = 'notes';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => { db.close(); resolve(out && out.result !== undefined ? out.result : out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

const NotesDB = {
  put: note => tx('readwrite', s => s.put(note)),
  get: id => tx('readonly', s => s.get(id)),
  all: () => tx('readonly', s => s.getAll()),
  del: id => tx('readwrite', s => s.delete(id)),
  clear: () => tx('readwrite', s => s.clear())
};
