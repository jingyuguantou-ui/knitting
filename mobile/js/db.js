const KnitDB = (() => {
  const DB_NAME = "knit-canvas";
  const STAMP_DB = "knit-stamps";
  const STORE = "projects";
  const STAMPS = "stamps";
  let _db = null;
  let _sdb = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function openStamps() {
    if (_sdb) return Promise.resolve(_sdb);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(STAMP_DB, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STAMPS)) {
          const s = db.createObjectStore(STAMPS, { keyPath: "id" });
          s.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = (e) => { _sdb = e.target.result; resolve(_sdb); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function store(name, mode, sdb) {
    const db = sdb ? await openStamps() : await open();
    return db.transaction(name, mode).objectStore(name);
  }

  function wrap(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = (e) => rej(req.error);
    });
  }

  function newId() {
    return "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  async function put(project) {
    const s = await store(STORE, "readwrite");
    project.updatedAt = Date.now();
    if (!project.createdAt) project.createdAt = project.updatedAt;
    await wrap(s.put(project));
    return project.id;
  }

  async function get(id) {
    const s = await store(STORE, "readonly");
    return (await wrap(s.get(id))) || null;
  }

  async function del(id) {
    const s = await store(STORE, "readwrite");
    await wrap(s.delete(id));
  }

  async function list() {
    const s = await store(STORE, "readonly");
    const all = await wrap(s.getAll());
    return all
      .map(({ id, title, cols, rows, palette, gauge, createdAt, updatedAt, thumb }) => ({
        id, title, cols, rows, paletteCount: palette ? palette.length : 0,
        gauge, createdAt, updatedAt, thumb: thumb || null
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function stampPut(rec) {
    const s = await store(STAMPS, "readwrite", true);
    rec.updatedAt = Date.now();
    if (!rec.createdAt) rec.createdAt = rec.updatedAt;
    await wrap(s.put(rec));
    return rec.id;
  }

  async function stampList() {
    const s = await store(STAMPS, "readonly", true);
    const all = await wrap(s.getAll());
    return all
      .map(({ id, name, w, h, updatedAt, thumb }) => ({ id, name, w, h, updatedAt, thumb: thumb || null }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function stampGet(id) {
    const s = await store(STAMPS, "readonly", true);
    return (await wrap(s.get(id))) || null;
  }

  async function stampDel(id) {
    const s = await store(STAMPS, "readwrite", true);
    await wrap(s.delete(id));
  }

  return { open, put, get, del, list, newId, stampPut, stampList, stampGet, stampDel };
})();
