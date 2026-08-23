const DB_NAME = 'speakup-recordings'
const STORE_NAME = 'recordings'
const DB_VERSION = 1
const MAX_RECORDINGS = 20

export type Recording = { id: string; ts: number; text: string; blob: Blob }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error as Error)
  })
}

function getAll(db: IDBDatabase): Promise<Recording[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as Recording[])
    req.onerror = () => reject(req.error as Error)
  })
}

// Corrupt or unavailable IndexedDB (private mode, quota errors) must not crash the app.
export async function saveRecording(r: Recording): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(r)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error as Error)
    })

    const all = (await getAll(db)).sort((a, b) => b.ts - a.ts)
    if (all.length > MAX_RECORDINGS) {
      const stale = all.slice(MAX_RECORDINGS)
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        for (const rec of stale) store.delete(rec.id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error as Error)
      })
    }
    db.close()
  } catch { /* ignore: storage unavailable */ }
}

export async function listRecordings(): Promise<Recording[]> {
  try {
    const db = await openDb()
    const all = await getAll(db)
    db.close()
    return all.sort((a, b) => b.ts - a.ts)
  } catch { return [] }
}

export async function clearRecordings(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error as Error)
    })
    db.close()
  } catch { /* ignore: storage unavailable */ }
}
