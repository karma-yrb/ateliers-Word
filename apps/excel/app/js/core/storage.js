(() => {
function createAtelierFileStorage(config = {}) {
  const settings = {
    dbName: config.dbName || "atelier_fs_settings_v1",
    pickerIds: {
      userFolder: config.pickerIds?.userFolder || "atelier-user-folder",
      userFolderOpen: config.pickerIds?.userFolderOpen || "atelier-user-folder-open",
      documentsRoot: config.pickerIds?.documentsRoot || "atelier-documents-root",
      scanRoot: config.pickerIds?.scanRoot || "atelier-scan-root",
    },
    progressFileName: config.progressFileName || "progression-atelier.json",
    workFilePickerDescription: config.workFilePickerDescription || "Fichier de travail",
    workFileAccept: config.workFileAccept || {},
    defaultWorkFileName: config.defaultWorkFileName || "fichier",
  };

  return class AtelierFileStorage {
  constructor() {
    this.dbName = settings.dbName;
    this.storeName = "settings";
    this.dbPromise = null;
    this.profileFileName = "profil-utilisateur.json";
  }

  isSupported() {
    return (
      typeof window.showDirectoryPicker === "function" &&
      typeof window.indexedDB !== "undefined" &&
      window.location.protocol !== "file:"
    );
  }

  /**
   * Donne une raison précise quand isSupported() renvoie false, pour
   * afficher un message d'erreur clair plutôt qu'un échec silencieux ou
   * un "NotAllowedError" cryptique en console.
   */
  getUnsupportedReason() {
    if (window.location.protocol === "file:") return "file-protocol";
    if (typeof window.showDirectoryPicker !== "function") return "no-file-system-api";
    if (typeof window.indexedDB === "undefined") return "no-indexeddb";
    return null;
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
      id: settings.pickerIds.userFolder,
      mode: "readwrite",
      startIn: "documents",
    });
  }

  async openUserDirectory(startHandle = null) {
    return window.showDirectoryPicker({
      id: settings.pickerIds.userFolderOpen,
      mode: "readwrite",
      startIn: startHandle || "documents",
    });
  }

  async pickDocumentsDirectory() {
    return window.showDirectoryPicker({
      id: settings.pickerIds.documentsRoot,
      mode: "read",
      startIn: "documents",
    });
  }

  async pickScanRootDirectory() {
    return window.showDirectoryPicker({
      id: settings.pickerIds.scanRoot,
      mode: "read",
    });
  }

  async ensureDirectoryPermission(handle, mode = "readwrite") {
    if (!handle) return false;
    try {
      const opts = { mode };
      const current = await handle.queryPermission(opts);
      if (current === "granted") return true;
      const requested = await handle.requestPermission(opts);
      return requested === "granted";
    } catch {
      return false;
    }
  }

  async queryDirectoryPermission(handle, mode = "readwrite") {
    if (!handle) return false;
    try {
      const opts = { mode };
      return (await handle.queryPermission(opts)) === "granted";
    } catch {
      return false;
    }
  }

  async requestDirectoryPermission(handle, mode = "readwrite") {
    if (!handle) return false;
    try {
      const opts = { mode };
      return (await handle.requestPermission(opts)) === "granted";
    } catch {
      return false;
    }
  }

  async ensureReadPermission(handle) {
    return this.ensureDirectoryPermission(handle, "read");
  }

  async ensureWritePermission(handle) {
    return this.ensureDirectoryPermission(handle, "readwrite");
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

    // If a parent folder was selected, resolve to the unique child that already
    // contains ProgressionAtelier to avoid creating nested duplicate structures.
    const nestedHandle = await this.findNestedProgressFolder(rootHandle);
    if (nestedHandle) return nestedHandle;

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

  async findNestedProgressFolder(parentHandle) {
    if (!parentHandle || parentHandle.kind !== "directory") return null;

    const matches = [];
    const maxItems = 250;
    let inspected = 0;

    try {
      for await (const [name, handle] of parentHandle.entries()) {
        inspected += 1;
        if (inspected > maxItems) break;
        if (matches.length > 1) return null;
        if (!handle || handle.kind !== "directory") continue;
        if (String(name || "").startsWith(".")) continue;

        try {
          await handle.getDirectoryHandle("ProgressionAtelier", { create: false });
          matches.push(handle);
        } catch {
          // ignore non-matching child folder
        }

        if (matches.length > 1) return null;
      }
    } catch {
      // L'itération elle-même a échoué (dossier nouveau ou permissions insuffisantes)
      return null;
    }

    return matches.length === 1 ? matches[0] : null;
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
      fileHandle = await progressDir.getFileHandle(settings.progressFileName);
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
    const fileHandle = await progressDir.getFileHandle(settings.progressFileName, { create: true });
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
    return `ProgressionAtelier/${settings.progressFileName}`;
  }

  async getSavedRootHandle() {
    return this.#getSetting("rootHandle");
  }

  async setSavedRootHandle(handle) {
    return this.#setSetting("rootHandle", handle);
  }

  async getSavedDocumentsHandle() {
    return this.#getSetting("documentsHandle");
  }

  async setSavedDocumentsHandle(handle) {
    return this.#setSetting("documentsHandle", handle);
  }

  async scanDocumentsFolders(documentsHandle, options = {}) {
    if (!documentsHandle || documentsHandle.kind !== "directory") return [];

    const includeWithoutProgress = options.includeWithoutProgress !== false;
    const maxItems = Number.isFinite(options.maxItems)
      ? Math.max(1, Math.min(500, Number(options.maxItems)))
      : 250;
    const folders = [];

    for await (const [name, handle] of documentsHandle.entries()) {
      if (folders.length >= maxItems) break;
      if (!handle || handle.kind !== "directory") continue;
      if (String(name || "").startsWith(".")) continue;

      const candidateHandle = (await this.resolveUserRootHandle(handle, "")) || handle;

      let hasProgressFolder = false;
      try {
        await candidateHandle.getDirectoryHandle("ProgressionAtelier", { create: false });
        hasProgressFolder = true;
      } catch {
        hasProgressFolder = false;
      }

      if (!hasProgressFolder && !includeWithoutProgress) continue;

      let alreadyAdded = false;
      for (const existing of folders) {
        try {
          if (await existing.handle.isSameEntry(candidateHandle)) {
            alreadyAdded = true;
            break;
          }
        } catch {
          if ((existing.name || "") === (candidateHandle.name || "")) {
            alreadyAdded = true;
            break;
          }
        }
      }
      if (alreadyAdded) continue;

      folders.push({
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: candidateHandle.name || String(name || "Dossier de travail"),
        handle: candidateHandle,
        hasProgressFolder,
      });
    }

    return folders.sort((a, b) => {
      if (a.hasProgressFolder !== b.hasProgressFolder) {
        return a.hasProgressFolder ? -1 : 1;
      }
      return String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" });
    });
  }

  async getSavedWorkFolders() {
    const raw = await this.#getSetting("workFolders");
    if (!Array.isArray(raw)) return [];
    const folders = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const handle = item.handle;
      if (!handle || handle.kind !== "directory") continue;
      const name = String(item.name || handle.name || "Dossier de travail").trim() || "Dossier de travail";
      folders.push({
        id: String(item.id || ""),
        name,
        handle,
        lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : "",
      });
    }
    return folders.filter((folder) => folder.id);
  }

  async setSavedWorkFolders(folders) {
    if (!Array.isArray(folders)) return this.#setSetting("workFolders", []);
    const payload = folders
      .filter((item) => item && item.handle && item.handle.kind === "directory")
      .map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || item.handle.name || "Dossier de travail").trim() || "Dossier de travail",
        handle: item.handle,
        lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : "",
      }))
      .filter((item) => item.id);
    return this.#setSetting("workFolders", payload);
  }

  async addSavedWorkFolder(handle) {
    if (!handle || handle.kind !== "directory") {
      return this.getSavedWorkFolders();
    }

    const now = new Date().toISOString();
    const existing = await this.getSavedWorkFolders();
    let updated = false;

    for (const folder of existing) {
      let same = false;
      try {
        same = await folder.handle.isSameEntry(handle);
      } catch {
        same = folder.name === (handle.name || folder.name);
      }
      if (!same) continue;

      folder.handle = handle;
      folder.name = handle.name || folder.name;
      folder.lastUsedAt = now;
      updated = true;
      break;
    }

    if (!updated) {
      existing.push({
        id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: handle.name || "Dossier de travail",
        handle,
        lastUsedAt: now,
      });
    }

    await this.setSavedWorkFolders(existing);
    return this.getSavedWorkFolders();
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

  supportsWorkFilePicker() {
    return typeof window.showOpenFilePicker === "function";
  }

  normalizeProfileKey(value) {
    return this.normalizeInitials(value) || "USER";
  }

  async pickWorkFile(options = {}) {
    if (!this.supportsWorkFilePicker()) return null;

    const pickerOptions = {
      multiple: false,
      startIn: options.startIn || "downloads",
      excludeAcceptAllOption: false,
      types: [
        {
          description: settings.workFilePickerDescription,
          accept: settings.workFileAccept,
        },
      ],
    };

    try {
      const handles = await window.showOpenFilePicker(pickerOptions);
      if (!Array.isArray(handles) || !handles.length) return null;
      const [handle] = handles;
      if (!handle || handle.kind !== "file") return null;
      return handle;
    } catch {
      return null;
    }
  }

  async ensureFileReadPermission(handle) {
    if (!handle || handle.kind !== "file") return false;
    try {
      const opts = { mode: "read" };
      const current = await handle.queryPermission(opts);
      if (current === "granted") return true;
      const requested = await handle.requestPermission(opts);
      return requested === "granted";
    } catch {
      return false;
    }
  }

  async getSavedExerciseFiles() {
    const raw = await this.#getSetting("exerciseFiles");
    if (!Array.isArray(raw)) return [];
    const items = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const handle = item.handle;
      if (!handle || handle.kind !== "file") continue;
      const profileKey = this.normalizeProfileKey(item.profileKey);
      const exerciseId = String(item.exerciseId || "").trim();
      if (!exerciseId) continue;
      items.push({
        profileKey,
        exerciseId,
        handle,
        fileName: String(item.fileName || handle.name || settings.defaultWorkFileName).trim() || settings.defaultWorkFileName,
        lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : "",
      });
    }
    return items;
  }

  async setSavedExerciseFiles(items) {
    if (!Array.isArray(items)) return this.#setSetting("exerciseFiles", []);
    const payload = items
      .filter((item) => item && item.handle && item.handle.kind === "file")
      .map((item) => ({
        profileKey: this.normalizeProfileKey(item.profileKey),
        exerciseId: String(item.exerciseId || "").trim(),
        handle: item.handle,
        fileName: String(item.fileName || item.handle.name || settings.defaultWorkFileName).trim() || settings.defaultWorkFileName,
        lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : "",
      }))
      .filter((item) => item.exerciseId);
    return this.#setSetting("exerciseFiles", payload);
  }

  async setSavedExerciseFile(profileKey, exerciseId, handle) {
    const cleanProfileKey = this.normalizeProfileKey(profileKey);
    const cleanExerciseId = String(exerciseId || "").trim();
    if (!cleanExerciseId || !handle || handle.kind !== "file") return null;

    const all = await this.getSavedExerciseFiles();
    const now = new Date().toISOString();
    const next = all.filter((entry) => !(entry.profileKey === cleanProfileKey && entry.exerciseId === cleanExerciseId));
    next.push({
      profileKey: cleanProfileKey,
      exerciseId: cleanExerciseId,
      handle,
      fileName: handle.name || settings.defaultWorkFileName,
      lastUsedAt: now,
    });
    await this.setSavedExerciseFiles(next);
    return {
      profileKey: cleanProfileKey,
      exerciseId: cleanExerciseId,
      handle,
      fileName: handle.name || settings.defaultWorkFileName,
      lastUsedAt: now,
    };
  }

  async getSavedExerciseFile(profileKey, exerciseId) {
    const cleanProfileKey = this.normalizeProfileKey(profileKey);
    const cleanExerciseId = String(exerciseId || "").trim();
    if (!cleanExerciseId) return null;
    const all = await this.getSavedExerciseFiles();
    return all.find((entry) => entry.profileKey === cleanProfileKey && entry.exerciseId === cleanExerciseId) || null;
  }

  async touchSavedExerciseFile(profileKey, exerciseId) {
    const cleanProfileKey = this.normalizeProfileKey(profileKey);
    const cleanExerciseId = String(exerciseId || "").trim();
    if (!cleanExerciseId) return null;

    const all = await this.getSavedExerciseFiles();
    const entry = all.find((item) => item.profileKey === cleanProfileKey && item.exerciseId === cleanExerciseId);
    if (!entry) return null;
    entry.lastUsedAt = new Date().toISOString();
    await this.setSavedExerciseFiles(all);
    return entry;
  }

  async getSavedExerciseDownloads() {
    const raw = await this.#getSetting("exerciseDownloads");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        profileKey: this.normalizeProfileKey(item.profileKey),
        exerciseId: String(item.exerciseId || "").trim(),
        fileName: String(item.fileName || "").trim(),
        sourceUrl: String(item.sourceUrl || "").trim(),
        lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : "",
      }))
      .filter((item) => item.exerciseId && item.fileName);
  }

  async setSavedExerciseDownloads(items) {
    if (!Array.isArray(items)) return this.#setSetting("exerciseDownloads", []);
    const payload = items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        profileKey: this.normalizeProfileKey(item.profileKey),
        exerciseId: String(item.exerciseId || "").trim(),
        fileName: String(item.fileName || "").trim(),
        sourceUrl: String(item.sourceUrl || "").trim(),
        lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : "",
      }))
      .filter((item) => item.exerciseId && item.fileName);
    return this.#setSetting("exerciseDownloads", payload);
  }

  async setSavedExerciseDownload(profileKey, exerciseId, fileName, sourceUrl = "") {
    const cleanProfileKey = this.normalizeProfileKey(profileKey);
    const cleanExerciseId = String(exerciseId || "").trim();
    const cleanFileName = String(fileName || "").trim();
    if (!cleanExerciseId || !cleanFileName) return null;

    const all = await this.getSavedExerciseDownloads();
    const now = new Date().toISOString();
    const next = all.filter((entry) => !(entry.profileKey === cleanProfileKey && entry.exerciseId === cleanExerciseId));
    next.push({
      profileKey: cleanProfileKey,
      exerciseId: cleanExerciseId,
      fileName: cleanFileName,
      sourceUrl: String(sourceUrl || "").trim(),
      lastUsedAt: now,
    });
    await this.setSavedExerciseDownloads(next);
    return next[next.length - 1];
  }

  async getSavedExerciseDownload(profileKey, exerciseId) {
    const cleanProfileKey = this.normalizeProfileKey(profileKey);
    const cleanExerciseId = String(exerciseId || "").trim();
    if (!cleanExerciseId) return null;
    const all = await this.getSavedExerciseDownloads();
    return all.find((entry) => entry.profileKey === cleanProfileKey && entry.exerciseId === cleanExerciseId) || null;
  }

  async touchSavedExerciseDownload(profileKey, exerciseId) {
    const cleanProfileKey = this.normalizeProfileKey(profileKey);
    const cleanExerciseId = String(exerciseId || "").trim();
    if (!cleanExerciseId) return null;

    const all = await this.getSavedExerciseDownloads();
    const entry = all.find((item) => item.profileKey === cleanProfileKey && item.exerciseId === cleanExerciseId);
    if (!entry) return null;
    entry.lastUsedAt = new Date().toISOString();
    await this.setSavedExerciseDownloads(all);
    return entry;
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

  ;
}

window.createAtelierFileStorage = createAtelierFileStorage;
})();
