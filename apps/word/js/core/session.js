(() => {
function createAtelierSessionRuntime(config = {}) {
  const storage = config.storage || null;
  const view = config.view || null;
  const progressFileName = config.progressFileName || "progression-atelier.json";
  const persistUserSnapshot = typeof config.persistUserSnapshot === "function"
    ? config.persistUserSnapshot
    : () => {};

  function deriveInitials(rootHandle, fallback = "") {
    const fromFallback = storage.normalizeInitials(fallback);
    if (fromFallback) return fromFallback;
    const fromFolderName = storage.normalizeInitials(rootHandle && rootHandle.name ? rootHandle.name : "");
    if (fromFolderName) return fromFolderName;
    return "USER";
  }

  function getMostRecentSavedFolder(savedWorkFolders) {
    if (!Array.isArray(savedWorkFolders) || !savedWorkFolders.length) return null;
    const orderedFolders = [...savedWorkFolders].sort((a, b) => {
      const left = Date.parse(a.lastUsedAt || "") || 0;
      const right = Date.parse(b.lastUsedAt || "") || 0;
      return right - left;
    });
    return orderedFolders[0] || null;
  }

  async function resolveExistingRootHandle(rootHandle, initials, allowPermissionPrompt) {
    if (!rootHandle) {
      return { rootHandle: null, accessible: false, savedWorkFolders: null };
    }

    let resolvedRootHandle = rootHandle;
    let ok = allowPermissionPrompt
      ? await storage.ensureWritePermission(resolvedRootHandle)
      : await storage.queryDirectoryPermission(resolvedRootHandle, "readwrite");

    if (ok) {
      resolvedRootHandle = await storage.resolveUserRootHandle(resolvedRootHandle, initials);
      ok = allowPermissionPrompt
        ? await storage.ensureWritePermission(resolvedRootHandle)
        : await storage.queryDirectoryPermission(resolvedRootHandle, "readwrite");
    }

    if (!ok && !allowPermissionPrompt) {
      return { rootHandle: resolvedRootHandle, accessible: false, savedWorkFolders: null };
    }
    if (!ok) {
      return { rootHandle: null, accessible: false, savedWorkFolders: null };
    }

    const savedWorkFolders = await storage.addSavedWorkFolder(resolvedRootHandle);
    return { rootHandle: resolvedRootHandle, accessible: true, savedWorkFolders };
  }

  async function hydrateExistingProfile(rootHandle, initials, firstName) {
    let resolvedInitials = initials;
    let resolvedFirstName = firstName;

    if (rootHandle && (!resolvedInitials || !resolvedFirstName)) {
      const profile = await storage.loadUserProfile(
        rootHandle,
        deriveInitials(rootHandle, resolvedInitials),
        false,
      );
      if (profile) {
        if (!resolvedInitials && profile.initials) {
          resolvedInitials = storage.normalizeInitials(profile.initials);
        }
        if (!resolvedFirstName && profile.firstName) {
          resolvedFirstName = storage.normalizeFirstName(profile.firstName);
        }
      }
    }

    if (rootHandle && !resolvedInitials) {
      resolvedInitials = deriveInitials(rootHandle, "");
    }

    return {
      initials: resolvedInitials,
      firstName: resolvedFirstName,
    };
  }

  function getSessionFolderName(rootHandle) {
    return rootHandle && rootHandle.name ? rootHandle.name : "Dossier choisi";
  }

  function persistSessionSnapshot(session) {
    if (!session) return;
    persistUserSnapshot({
      firstName: session.firstName,
      initials: session.initials,
      folderName: getSessionFolderName(session.rootHandle),
    });
  }

  async function persistResolvedSession(session) {
    await storage.ensureProgressDirectory(session.rootHandle, session.initials, true);
    await storage.saveUserProfile(session.rootHandle, session.initials, session.firstName);
    await storage.addSavedWorkFolder(session.rootHandle);
    await storage.setSavedRootHandle(session.rootHandle);
    await storage.setSavedInitials(session.initials);
    await storage.setSavedFirstName(session.firstName);
    persistSessionSnapshot(session);
  }

  function syncSessionIdentity(session) {
    view.setHeaderUser(session.firstName, session.initials);
    const folderName = getSessionFolderName(session.rootHandle);
    view.setProgressUserPath(`Fichier: ${folderName} > ProgressionAtelier > ${progressFileName}`);
    persistSessionSnapshot(session);
  }

  return {
    deriveInitials,
    getMostRecentSavedFolder,
    resolveExistingRootHandle,
    hydrateExistingProfile,
    getSessionFolderName,
    persistSessionSnapshot,
    persistResolvedSession,
    syncSessionIdentity,
  };
}

window.createAtelierSessionRuntime = createAtelierSessionRuntime;
})();
