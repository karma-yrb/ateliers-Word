(() => {
function createAtelierWorkFileRuntime(config = {}) {
  const storage = config.storage || null;
  const view = config.view || null;
  const model = config.model || null;
  const officeAppName = config.officeAppName || "application bureautique";
  const completedFileExtension = config.completedFileExtension || "dat";
  const getUserSession = typeof config.getUserSession === "function" ? config.getUserSession : () => null;
  const getCurrentExerciseIdFromView = typeof config.getCurrentExerciseIdFromView === "function"
    ? config.getCurrentExerciseIdFromView
    : () => "";

  function buildWorkFileProfileKey() {
    const userSession = getUserSession();
    if (!userSession || !userSession.initials) return "USER";
    if (!storage || !storage.normalizeProfileKey) return String(userSession.initials).trim() || "USER";
    return storage.normalizeProfileKey(userSession.initials);
  }

  async function refreshExerciseWorkFileState(exerciseId, options = {}) {
    if (!view || !view.setExerciseWorkFileState) return;
    const userSession = getUserSession();
    const filePickerSupported = Boolean(
      storage
      && storage.supportsWorkFilePicker
      && storage.supportsWorkFilePicker(),
    );

    if (!exerciseId || !userSession || !filePickerSupported) {
      view.setExerciseWorkFileState({
        pickerSupported: filePickerSupported,
        openVisible: false,
        statusText: filePickerSupported ? "" : "Selection du fichier indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = buildWorkFileProfileKey();
    const entry = await storage.getSavedExerciseDownload(profileKey, exerciseId);
    const selectedFile = storage.getSavedExerciseFile
      ? await storage.getSavedExerciseFile(profileKey, exerciseId)
      : null;

    const fileName = selectedFile && selectedFile.fileName
      ? selectedFile.fileName
      : entry && entry.fileName ? entry.fileName : "";

    view.setExerciseWorkFileState({
      pickerSupported: filePickerSupported,
      openVisible: Boolean(fileName),
      fileName,
      statusText: options.statusText || "",
    });
  }

  function getCanonicalExerciseDownloadFileName(exerciseId, downloadUrl) {
    const exercise = exerciseId ? model.getExerciseById(exerciseId) : null;
    const exerciseNumber = Number(exercise && exercise.num);
    const exerciseFileStem = Number.isFinite(exerciseNumber) && exerciseNumber > 0
      ? `ex-${String(exerciseNumber).padStart(3, "0")}`
      : String(exerciseId || "")
        .trim()
        .toLowerCase()
        .replace(/^excel-ex-(\d{1,3})$/, (_match, value) => `ex-${String(value).padStart(3, "0")}`)
        .replace(/^ex-(\d{1,3})$/, (_match, value) => `ex-${String(value).padStart(3, "0")}`)
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "fichier-telecharge";
    let extension = "";

    try {
      const parsed = new URL(String(downloadUrl || ""), window.location.href);
      const lastSegment = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
      const extensionMatch = lastSegment.match(/\.[a-z0-9]{2,8}$/i);
      if (extensionMatch) extension = extensionMatch[0].toLowerCase();
    } catch {
      // conserve l'extension vide si l'URL est invalide
    }

    return `${exerciseFileStem}${extension}`;
  }

  function getDownloadFileNameFromLink(linkEl) {
    if (!linkEl) return "fichier-telecharge";
    const exerciseId = getCurrentExerciseIdFromView();
    return getCanonicalExerciseDownloadFileName(exerciseId, linkEl.getAttribute("href"));
  }

  async function fileExistsInDirectory(directoryHandle, fileName) {
    if (!directoryHandle || directoryHandle.kind !== "directory" || !fileName) return null;
    try {
      if (storage && storage.queryDirectoryPermission) {
        const allowed = await storage.queryDirectoryPermission(directoryHandle, "read");
        if (!allowed) return null;
      }
      await directoryHandle.getFileHandle(fileName, { create: false });
      return true;
    } catch {
      return false;
    }
  }

  function getSaveReminderFolderLabel() {
    const userSession = getUserSession();
    if (!userSession || !userSession.rootHandle) {
      return "Dossier utilisateur";
    }
    return userSession.rootHandle.name || "Dossier utilisateur";
  }

  function getDefaultSaveReminderFileName() {
    return `exercice-termine.${completedFileExtension}`;
  }

  function getNumberedSaveReminderFileName(exerciseNumber) {
    return `ex-${String(exerciseNumber).padStart(3, "0")}-termine.${completedFileExtension}`;
  }

  function getSaveReminderFileName(exerciseId) {
    if (!exerciseId) return getDefaultSaveReminderFileName();
    const normalized = String(exerciseId).trim().toLowerCase();
    const normalizedMatch = normalized.match(/^ex-(\d+)$/);
    if (normalizedMatch) {
      return `ex-${String(normalizedMatch[1]).padStart(3, "0")}-termine.${completedFileExtension}`;
    }
    const exercise = model.getExerciseById(exerciseId);
    if (!exercise || typeof exercise.num !== "number") return getDefaultSaveReminderFileName();
    return getNumberedSaveReminderFileName(exercise.num);
  }

  async function buildDownloadExistingStatus() {
    return { important: false, html: "" };
  }

  async function trackExerciseDownloadFromLink(linkEl) {
    const userSession = getUserSession();
    if (!userSession || !storage || !linkEl) return;
    const exerciseId = getCurrentExerciseIdFromView();
    const href = linkEl.getAttribute("href");
    if (!exerciseId || !href) return;

    const fileName = getDownloadFileNameFromLink(linkEl);
    await storage.setSavedExerciseDownload(buildWorkFileProfileKey(), exerciseId, fileName, href);
    await refreshExerciseWorkFileState(exerciseId, {
      statusText: `Telechargement lance. Ouvrez le document dans ${officeAppName}, cliquez sur "Activer la modification", enregistrez ${fileName} dans votre dossier utilisateur, puis cliquez sur "Selectionner mon fichier".`,
    });
  }

  return {
    buildWorkFileProfileKey,
    refreshExerciseWorkFileState,
    getCanonicalExerciseDownloadFileName,
    getDownloadFileNameFromLink,
    fileExistsInDirectory,
    getSaveReminderFolderLabel,
    getDefaultSaveReminderFileName,
    getNumberedSaveReminderFileName,
    getSaveReminderFileName,
    buildDownloadExistingStatus,
    trackExerciseDownloadFromLink,
  };
}

window.createAtelierWorkFileRuntime = createAtelierWorkFileRuntime;
})();
