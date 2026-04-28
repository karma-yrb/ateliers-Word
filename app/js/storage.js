class WordAtelierFileStorage {
  constructor() {
    this.dbName = "word_atelier_fs_settings_v1";
    this.storeName = "settings";
    this.dbPromise = null;
    this.profileFileName = "profil-utilisateur.json";
  }

  isSupported() {
    return typeof window.showDirectoryPicker === "function" && typeof window.indexedDB !== "undefined";
  }

  normalizeInitials(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
  }

  normalizeFirstName(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30);
  }

  async pickRootDirectory() {
    return this.pickUserDirectory();
  }

  async pickUserDirectory() {
    return window.showDirectoryPicker({
      id: "word-atelier-user-folder",
      mode: "readwrite",
      startIn: "documents",
    });
  }

  async ensureWritePermission(handle) {
    if (!handle) return false;
    try {
      const opts = { mode: "readwrite" };
      const current = await handle.queryPermission(opts);
      if (current === "granted") return true;
      const requested = await handle.requestPermission(opts);
      return requested === "granted";
    } catch {
      return false;
    }
  }

  async resolveUserRootHandle(rootHandle, initials) {
    if (!rootHandle) return null;

    // New structure: selected user folder contains ProgressionAtelier directly.
    try {
      await rootHandle.getDirectoryHandle("ProgressionAtelier", { create: false });
      return rootHandle;
    } catch {
      // continue
    }

    // Legacy structure: parent folder > INITIALS > ProgressionAtelier.
    const clean = this.normalizeInitials(initials);
    if (!clean) return rootHandle;
    try {
      const legacyUserDir = await rootHandle.getDirectoryHandle(clean, { create: false });
      await legacyUserDir.getDirectoryHandle("ProgressionAtelier", { create: false });
      return legacyUserDir;
    } catch {
      return rootHandle;
    }
  }

  async listUserFolders(rootHandle) {
    const users = [];
    for await (const [name, handle] of rootHandle.entries()) {
      if (handle.kind !== "directory") continue;
      if (!/^[A-Za-z0-9]{1,8}$/.test(name)) continue;
      users.push(name.toUpperCase());
    }
    return [...new Set(users)].sort();
  }

  async ensureProgressDirectory(rootHandle, initials, create = true) {
    if (!rootHandle) throw new Error("Dossier utilisateur manquant");
    return rootHandle.getDirectoryHandle("ProgressionAtelier", { create });
  }

  async loadProgress(rootHandle, initials) {
    const progressDir = await this.ensureProgressDirectory(rootHandle, initials, true);
    let fileHandle = null;
    try {
      fileHandle = await progressDir.getFileHandle("progression-word.json");
    } catch {
      return null;
    }

    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      if (!text || !text.trim()) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async saveProgress(rootHandle, initials, progressObject) {
    const progressDir = await this.ensureProgressDirectory(rootHandle, initials, true);
    const fileHandle = await progressDir.getFileHandle("progression-word.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(progressObject, null, 2));
    await writable.close();
  }

  async loadUserProfile(rootHandle, initials, create = false) {
    const progressDir = await this.ensureProgressDirectory(rootHandle, initials, create);
    let fileHandle = null;
    try {
      fileHandle = await progressDir.getFileHandle(this.profileFileName);
    } catch {
      return null;
    }

    try {
      const file = await fileHandle.getFile();
      const text = await file.text();
      if (!text || !text.trim()) return null;
      const parsed = JSON.parse(text);
      const firstName = this.normalizeFirstName(parsed && parsed.firstName);
      const normalizedInitials = this.normalizeInitials((parsed && parsed.initials) || initials);
      if (!firstName) return null;
      return { initials: normalizedInitials, firstName };
    } catch {
      return null;
    }
  }

  async saveUserProfile(rootHandle, initials, firstName) {
    const cleanInitials = this.normalizeInitials(initials);
    const cleanFirstName = this.normalizeFirstName(firstName);
    if (!cleanInitials || !cleanFirstName) return;

    const progressDir = await this.ensureProgressDirectory(rootHandle, cleanInitials, true);
    const fileHandle = await progressDir.getFileHandle(this.profileFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({
      initials: cleanInitials,
      firstName: cleanFirstName,
      updatedAt: new Date().toISOString(),
    }, null, 2));
    await writable.close();
  }

  async deleteUserProfile(rootHandle, initials) {
    try {
      const progressDir = await this.ensureProgressDirectory(rootHandle, initials, false);
      await progressDir.removeEntry(this.profileFileName);
      return true;
    } catch {
      return false;
    }
  }

  getProgressRelativePath(initials) {
    return "ProgressionAtelier/progression-word.json";
  }

  async getSavedRootHandle() {
    return this.#getSetting("rootHandle");
  }

  async setSavedRootHandle(handle) {
    return this.#setSetting("rootHandle", handle);
  }

  async getSavedInitials() {
    const initials = await this.#getSetting("initials");
    return this.normalizeInitials(initials);
  }

  async setSavedInitials(initials) {
    return this.#setSetting("initials", this.normalizeInitials(initials));
  }

  async getSavedFirstName() {
    const firstName = await this.#getSetting("firstName");
    return this.normalizeFirstName(firstName);
  }

  async setSavedFirstName(firstName) {
    return this.#setSetting("firstName", this.normalizeFirstName(firstName));
  }

  async clearSavedSession() {
    const results = await Promise.all([
      this.#deleteSetting("rootHandle"),
      this.#deleteSetting("initials"),
      this.#deleteSetting("firstName"),
    ]);
    return results.every(Boolean);
  }

  async #openDb() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB indisponible"));
    });
    return this.dbPromise;
  }

  async #getSetting(key) {
    try {
      const db = await this.#openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("Lecture IndexedDB impossible"));
      });
    } catch {
      return null;
    }
  }

  async #setSetting(key, value) {
    try {
      const db = await this.#openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error("Ecriture IndexedDB impossible"));
      });
      return true;
    } catch {
      return false;
    }
  }

  async #deleteSetting(key) {
    try {
      const db = await this.#openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error("Suppression IndexedDB impossible"));
      });
      return true;
    } catch {
      return false;
    }
  }
}

window.WordAtelierFileStorage = WordAtelierFileStorage;
