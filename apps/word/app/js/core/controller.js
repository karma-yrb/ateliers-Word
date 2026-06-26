(() => {
function createAtelierController(config = {}) {
  const settings = {
    progressFileName: config.progressFileName || "progression-atelier.json",
    officeAppName: config.officeAppName || "application bureautique",
    completedFileExtension: config.completedFileExtension || "dat",
  };

  return class AtelierController {
  constructor(model, view, storage) {
    this.model = model;
    this.view = view;
    this.storage = storage;

    this.currentThemeId = this.model.getDefaultThemeId();
    this.currentAffinityId = this.model.getAffinityIdForTheme(this.currentThemeId) || this.model.getDefaultAffinityId();

    this.isReady = false;
    this.userSession = null;
    this.pendingPermissionSession = null;
    this.saveQueue = Promise.resolve();
    this.exerciseWorkFileToken = 0;
    this.routeStorageKey = `atelier:last-hash:${settings.progressFileName}`;
    this.uiStateStorageKey = `atelier:last-ui-state:${settings.progressFileName}`;
    this.userSnapshotStorageKey = `atelier:last-user:${settings.progressFileName}`;
    this.persistenceRuntime = window.createAtelierPersistenceRuntime({
      localStorage: window.localStorage,
      routeStorageKey: this.routeStorageKey,
      uiStateStorageKey: this.uiStateStorageKey,
      userSnapshotStorageKey: this.userSnapshotStorageKey,
      model: this.model,
    });
    this.homeRuntime = window.createAtelierHomeRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
    });
    this.themesRuntime = window.createAtelierThemesRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
      getCurrentThemeId: () => this.currentThemeId,
      setCurrentThemeId: (themeId) => {
        this.currentThemeId = themeId;
      },
      setCurrentAffinityId: (affinityId) => {
        this.currentAffinityId = affinityId;
      },
    });
    this.sessionRuntime = window.createAtelierSessionRuntime({
      storage: this.storage,
      view: this.view,
      progressFileName: settings.progressFileName,
      persistUserSnapshot: (snapshot) => this.persistenceRuntime.persistUserSnapshot(snapshot),
    });
    this.workFileRuntime = window.createAtelierWorkFileRuntime({
      storage: this.storage,
      view: this.view,
      model: this.model,
      officeAppName: settings.officeAppName,
      completedFileExtension: settings.completedFileExtension,
      getUserSession: () => this.userSession,
      getCurrentExerciseIdFromView: () => this.#getCurrentExerciseIdFromView(),
    });

    this.userModal = {
      root: document.getElementById("user-setup-modal"),
      status: document.getElementById("user-setup-status"),
      savedFoldersWrap: document.getElementById("user-setup-saved-folders-wrap"),
      savedFoldersSelect: document.getElementById("user-setup-saved-folders-select"),
      pickBtn: document.getElementById("user-setup-pick-root-btn"),
      firstNameInput: document.getElementById("user-setup-firstname-input"),
      cancelBtn: document.getElementById("user-setup-cancel-btn"),
      validateBtn: document.getElementById("user-setup-validate-btn"),
    };

    this.saveReminderModal = {
      root: document.getElementById("save-reminder-modal"),
      message: document.getElementById("save-reminder-message"),
      userFolder: document.getElementById("save-reminder-user-folder"),
      fileName: document.getElementById("save-reminder-file-name"),
      existingStatus: document.getElementById("save-reminder-existing-status"),
      cancelBtn: document.getElementById("save-reminder-cancel-btn"),
      continueBtn: document.getElementById("save-reminder-continue-btn"),
    };
    this.reminderModalRuntime = window.createAtelierReminderModalRuntime({
      modalRefs: this.saveReminderModal,
      windowRef: window,
    });
    this.userSetupRuntime = window.createAtelierUserSetupRuntime({
      storage: this.storage,
      modalRefs: this.userModal,
      deriveInitials: (rootHandle, fallback) => this.#deriveInitials(rootHandle, fallback),
      documentRef: document,
    });
    this.progressRuntime = window.createAtelierProgressRuntime({
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      model: this.model,
    });
    this.profileRuntime = window.createAtelierProfileRuntime({
      documentRef: document,
      persistenceRuntime: this.persistenceRuntime,
      view: this.view,
      storage: this.storage,
      getUserSession: () => this.userSession,
      setUserSession: (session) => {
        this.userSession = session;
      },
    });
  }

  init() {
    this.#bindStaticEvents();
    this.#bindDynamicEvents();
    window.addEventListener("hashchange", () => {
      this.persistenceRuntime.persistCurrentHash(window.location.hash);
      if (this.isReady) this.#renderFromHash();
    });

    if (!window.location.hash) {
      const restoredHash = this.persistenceRuntime.getPersistedHash();
      window.location.hash = restoredHash || "#home";
    } else {
      this.persistenceRuntime.persistCurrentHash(window.location.hash);
    }

    this.#bootstrap().catch(() => {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Erreur d'initialisation utilisateur.");
      this.view.showPage("home");
    });
  }

  async #bootstrap() {
    if (!this.storage || !this.storage.isSupported()) {
      const snapshot = this.persistenceRuntime.getPersistedUserSnapshot();
      if (snapshot && (snapshot.firstName || snapshot.initials)) {
        this.view.setHeaderUser(snapshot.firstName || "", snapshot.initials || "");
        this.view.setProgressUserPath(snapshot.folderName
          ? `Dernier dossier connu : ${snapshot.folderName}`
          : "Dernier dossier utilisateur connu.");
        this.view.setProgressStatus("Sauvegarde dossier indisponible, profil local affiche.");
        this.#renderFromHash();
        return;
      }
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Ce navigateur ne permet pas la sauvegarde automatique locale (utiliser Edge/Chrome récents).");
      this.view.showPage("home");
      return;
    }

    const session = await this.#resolveUserSession(false, { allowPermissionPrompt: false });
    if (!session) {
      const snapshot = this.persistenceRuntime.getPersistedUserSnapshot();
      if (snapshot && (snapshot.firstName || snapshot.initials)) {
        this.view.setHeaderUser(snapshot.firstName || "", snapshot.initials || "");
        this.view.setProgressUserPath(snapshot.folderName
          ? `Dernier dossier connu : ${snapshot.folderName}`
          : "Dernier dossier utilisateur connu.");
        this.view.setProgressStatus("Profil local retrouve, mais l'acces au dossier doit etre reactive.");
        this.#renderFromHash();
        return;
      }
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Aucun utilisateur configuré.");
      this.view.showPage("home");
      return;
    }
    if (session.permissionRequired) {
      this.pendingPermissionSession = session;
      this.view.setHeaderUser(session.firstName || "", session.initials || "");
      this.view.setProgressStatus("Accès dossier requis. Cliquez sur « Commencer maintenant » pour autoriser l'accès.");
      this.#renderFromHash();
      return;
    }

    await this.#activateSession(session, { render: true });
  }

  #bindStaticEvents() {
    for (const btn of this.view.navButtons) {
      btn.addEventListener("click", async () => {
        const page = btn.getAttribute("data-nav");
        if (!this.isReady && page !== "home") {
          const ready = await this.#ensureReadyFromUserGesture();
          if (!ready) {
            window.location.hash = "#home";
            return;
          }
        }
        if (page === "home") window.location.hash = "#home";
        if (page === "themes") window.location.hash = "#themes";
        if (page === "progress") window.location.hash = "#progress";
        if (page === "profile") window.location.hash = "#profile";
      });
    }

    document.getElementById("home-start-btn").addEventListener("click", async () => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      const resume = this.model.getResumeExercise();
      if (resume) {
        window.location.hash = `#exercise/${resume.id}`;
      } else {
        const preferredThemeId = this.currentThemeId || this.model.getDefaultThemeId();
        const first = preferredThemeId ? this.model.getExercisesByTheme(preferredThemeId)[0] : null;
        if (first) {
          window.location.hash = `#exercise/${first.id}`;
        } else {
          window.location.hash = "#themes";
        }
      }
    });

    document.getElementById("exercise-back-btn").addEventListener("click", async () => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      if (this.currentAffinityId) {
        window.location.hash = `#affinity/${this.currentAffinityId}/${this.currentThemeId || ""}`;
      } else {
        window.location.hash = "#themes";
      }
    });

    document.getElementById("affinity-back-btn").addEventListener("click", async () => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      window.location.hash = "#themes";
    });

    this.view.exercisePrevBtn.addEventListener("click", async () => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      const targetId = this.view.exercisePrevBtn.getAttribute("data-target-id");
      if (targetId) window.location.hash = `#exercise/${targetId}`;
    });

    this.view.exerciseNextBtn.addEventListener("click", async () => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      const currentId = this.view.exerciseToggleDoneBtn.getAttribute("data-id");
      const wasDone = currentId ? this.model.getIsDone(currentId) : false;
      if (currentId && !wasDone) {
        const canContinue = await this.#showSaveReminderModal("next", currentId);
        if (!canContinue) return;
      }

      if (currentId && !wasDone) {
        this.model.markExerciseDone(currentId, true);
        this.#saveProgress();
      }
      const targetId = this.view.exerciseNextBtn.getAttribute("data-target-id");
      if (targetId) window.location.hash = `#exercise/${targetId}`;
    });

    this.view.exerciseToggleDoneBtn.addEventListener("click", async () => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      const id = this.view.exerciseToggleDoneBtn.getAttribute("data-id");
      if (!id) return;
      const isDone = this.model.getIsDone(id);

      if (!isDone) {
        const canContinue = await this.#showSaveReminderModal("done", id);
        if (!canContinue) return;
      }

      this.model.markExerciseDone(id, !isDone);
      this.#saveProgress();
      this.#renderExercisePage(id);
    });

    if (this.view.exercisePickWorkFileBtn) {
      this.view.exercisePickWorkFileBtn.addEventListener("click", async () => {
        await this.#pickWorkFileForCurrentExercise();
      });
    }

    if (this.view.exerciseOpenWorkFileBtn) {
      this.view.exerciseOpenWorkFileBtn.addEventListener("click", async () => {
        await this.#openWorkFileForCurrentExercise();
      });
    }

    if (this.view.exerciseWorkFileBtn) {
      this.view.exerciseWorkFileBtn.addEventListener("click", (event) => {
        this.#handleExerciseDownloadClick(event, this.view.exerciseWorkFileBtn);
      });
    }

    if (this.view.exerciseDownloadBtn) {
      this.view.exerciseDownloadBtn.addEventListener("click", (event) => {
        this.#handleExerciseDownloadClick(event, this.view.exerciseDownloadBtn);
      });
    }

    const changeBtn = document.getElementById("progress-change-user-btn");
    if (changeBtn) {
      changeBtn.addEventListener("click", async () => {
        const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
        if (!session) return;
        await this.#activateSession(session, { render: this.isReady });
      });
    }

    const resetBtn = document.getElementById("progress-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (!this.isReady) return;
        const ok = window.confirm("Réinitialiser toute la progression de cet utilisateur ?");
        if (!ok) return;
        this.model.resetProgress();
        this.#saveProgress();
        this.view.setProgressStatus("Progression réinitialisée (profil conservé).");
        this.#renderFromHash();
      });
    }

    const resetProfileBtn = document.getElementById("progress-reset-profile-btn");
    if (resetProfileBtn) {
      resetProfileBtn.addEventListener("click", async () => {
        if (!this.userSession) return;
        const ok = window.confirm(
          "Supprimer le prénom et le dossier de référence sur cet appareil ? La progression enregistrée dans le dossier utilisateur ne sera pas supprimée.",
        );
        if (!ok) return;

        const previousSession = this.userSession;
        await this.storage.deleteUserProfile(previousSession.rootHandle, previousSession.initials);
        await this.storage.clearSavedSession();

        this.userSession = null;
        this.isReady = false;
        this.model.resetProgress();
        this.view.setHeaderUser("", "");
        this.view.setProgressUserPath("Aucun utilisateur sélectionné.");
        this.view.setProgressStatus("Profil local supprimé. Reconfiguration en cours...");

        const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
        if (!session) {
          this.view.setProgressStatus("Profil local supprimé. Configuration utilisateur annulée.");
          this.view.showPage("home");
          return;
        }

        await this.#activateSession(session, { render: true });
      });
    }

    const headerUserBtn = document.getElementById("header-user-badge");
    const headerUserMenu = document.getElementById("header-user-menu");
    const closeUserMenu = () => {
      if (!headerUserMenu) return;
      headerUserMenu.hidden = true;
      if (headerUserBtn) headerUserBtn.setAttribute("aria-expanded", "false");
    };
    if (headerUserBtn && headerUserMenu) {
      headerUserBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = !headerUserMenu.hidden;
        if (isOpen) {
          closeUserMenu();
        } else {
          headerUserMenu.hidden = false;
          headerUserBtn.setAttribute("aria-expanded", "true");
        }
      });
      document.addEventListener("click", closeUserMenu);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeUserMenu(); });
      const headerSwitchBtn = document.getElementById("header-user-switch-btn");
      if (headerSwitchBtn) {
        headerSwitchBtn.addEventListener("click", async () => {
          closeUserMenu();
          const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
          if (!session) return;
          await this.#activateSession(session, { render: this.isReady });
        });
      }
      const headerProfileBtn = document.getElementById("header-user-profile-btn");
      if (headerProfileBtn) {
        headerProfileBtn.addEventListener("click", async () => {
          closeUserMenu();
          if (!this.isReady) {
            const ready = await this.#ensureReadyFromUserGesture();
            if (!ready) return;
          }
          window.location.hash = "#profile";
        });
      }
    }
  }

  #bindDynamicEvents() {
    const onAction = async (event) => {
      if (!this.isReady) {
        const ready = await this.#ensureReadyFromUserGesture();
        if (!ready) return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionEl = target.closest("[data-action]");
      if (!actionEl) return;
      const action = actionEl.getAttribute("data-action");

      if (action === "open-affinity") {
        const affinityId = actionEl.getAttribute("data-affinity-id");
        if (!affinityId) return;
        window.location.hash = `#affinity/${affinityId}`;
        return;
      }

      if (action === "toggle-theme") {
        const themeId = actionEl.getAttribute("data-theme-id");
        const affinityId = actionEl.getAttribute("data-affinity-id") || this.currentAffinityId;
        if (!themeId || !affinityId) return;
        const sameThemeOpen = this.currentThemeId === themeId;
        const nextHash = sameThemeOpen ? `#affinity/${affinityId}` : `#affinity/${affinityId}/${themeId}`;
        window.location.hash = nextHash;
        return;
      }

      const id = actionEl.getAttribute("data-id");
      if (!id) return;

      if (action === "open-exercise") {
        window.location.hash = `#exercise/${id}`;
        return;
      }

      if (action === "toggle-done") {
        const isDone = this.model.getIsDone(id);
        this.model.markExerciseDone(id, !isDone);
        this.#saveProgress();
        this.#renderFromHash();
      }
    };

    const onActionKeydown = (event) => {
      if (!this.isReady) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("exercise-row")) return;
      const action = target.getAttribute("data-action");
      const id = target.getAttribute("data-id");
      if (action !== "open-exercise" || !id) return;
      event.preventDefault();
      window.location.hash = `#exercise/${id}`;
    };

    this.view.themesAffinityList.addEventListener("click", onAction);
    this.view.affinityThemeList.addEventListener("click", onAction);
    this.view.affinityThemeList.addEventListener("keydown", onActionKeydown);
  }

  #renderFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    const [route, param1, param2] = hash.split("/");

    if (route === "themes") {
      this.#renderThemesOverview();
      return;
    }
    if (route === "affinity") {
      this.#renderAffinityPage(param1 || null, param2 || null);
      return;
    }
    if (route === "exercise") {
      if (param1) {
        this.#renderExercisePage(param1);
        return;
      }
    }
    if (route === "progress") {
      this.#renderProgressPage();
      return;
    }
    if (route === "profile") {
      this.#renderProfilePage();
      return;
    }

    this.#renderHomePage();
  }

  #renderHomePage() {
    this.homeRuntime.render();
  }
  #renderThemesOverview() {
    this.themesRuntime.renderOverview();
  }

  #renderAffinityPage(affinityId, themeId) {
    this.themesRuntime.renderAffinityPage(affinityId, themeId);
  }

  #renderExercisePage(exerciseId) {
    const exercise = this.model.getExerciseById(exerciseId);
    if (!exercise) {
      if (this.currentAffinityId) {
        this.#renderAffinityPage(this.currentAffinityId, this.currentThemeId);
      } else {
        this.#renderThemesOverview();
      }
      return;
    }
    this.currentThemeId = exercise.moduleId;
    this.currentAffinityId = this.model.getAffinityIdForTheme(exercise.moduleId) || this.currentAffinityId;
    this.persistenceRuntime.persistUiState({
      page: "exercise",
      exerciseId: exercise.id,
      affinityId: this.currentAffinityId || "",
      themeId: this.currentThemeId || "",
    });
    if (this.model.markExerciseOpened(exercise.id)) {
      this.#saveProgress();
    }
    this.view.showPage("exercise");

    const done = this.model.getIsDone(exercise.id);
    const stepsVm = this.model.getExerciseStepsView
      ? this.model.getExerciseStepsView(exercise)
      : { preamble: "", steps: this.model.getStepsForExercise(exercise) };
    const visuals = this.model.getVisualsForExercise(exercise);
    const { prevId, nextId } = this.model.getNeighbors(exercise.id);
    this.view.renderExercise({
      exercise: {
        ...exercise,
        preamble: stepsVm.preamble || "",
      },
      done,
      steps: stepsVm.steps || [],
      visuals,
      prevId,
      nextId,
      workFile: {
        pickerSupported: this.storage && this.storage.supportsWorkFilePicker && this.storage.supportsWorkFilePicker(),
      },
    });
    this.#refreshExerciseWorkFileState(exercise.id);
  }

  #renderProgressPage() {
    this.progressRuntime.render();
  }

  // FIX 2 — Page Profil : affiche les infos utilisateur et permet de modifier le prénom inline.
  // Prérequis HTML : <div id="profile-user-section"></div> dans #page-profile.
  #renderProfilePage() {
    this.profileRuntime.render();
  }

  #deriveInitials(rootHandle, fallback = "") {
    return this.sessionRuntime.deriveInitials(rootHandle, fallback);
  }

  async #activateSession(session, options = {}) {
    this.userSession = session;
    this.pendingPermissionSession = null;
    await this.#loadProgressForSession(session);
    this.isReady = true;
    if (options.render) {
      this.#renderFromHash();
    }
  }

  async #resumePendingSessionFromUserGesture() {
    if (!this.pendingPermissionSession) return false;
    if (!this.pendingPermissionSession.rootHandle) {
      this.pendingPermissionSession = null;
      const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
      if (!session) {
        this.view.setProgressStatus("Configuration utilisateur annulee.");
        return false;
      }
      await this.#activateSession(session, { render: true });
      return true;
    }

    const pending = this.pendingPermissionSession;
    let selectedHandle = pending.rootHandle;
    let ok = await this.storage.requestDirectoryPermission(selectedHandle, "readwrite");

    if (ok) {
      selectedHandle = await this.storage.resolveUserRootHandle(selectedHandle, pending.initials || "");
      ok = await this.storage.requestDirectoryPermission(selectedHandle, "readwrite");
    }

    if (!ok) {
      this.view.setProgressStatus("Accès au dossier refusé. Cliquez à nouveau sur « Commencer maintenant » pour réessayer.");
      return false;
    }

    await this.storage.setSavedRootHandle(selectedHandle);
    const session = await this.#resolveUserSession(false, { allowPermissionPrompt: false });
    if (!session || session.permissionRequired) {
      this.view.setProgressStatus("Impossible de restaurer la session. Rechoisissez un dossier utilisateur.");
      return false;
    }

    await this.#activateSession(session, { render: true });
    return true;
  }

  async #ensureReadyFromUserGesture() {
    if (this.isReady) return true;

    if (this.pendingPermissionSession) {
      return this.#resumePendingSessionFromUserGesture();
    }

    const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
    if (!session) {
      this.view.setProgressStatus("Configuration utilisateur annulée.");
      return false;
    }

    await this.#activateSession(session);
    return true;
  }

  #getMostRecentSavedFolder(savedWorkFolders) {
    return this.sessionRuntime.getMostRecentSavedFolder(savedWorkFolders);
  }

  async #resolveExistingRootHandle(rootHandle, initials, allowPermissionPrompt) {
    return this.sessionRuntime.resolveExistingRootHandle(rootHandle, initials, allowPermissionPrompt);
  }

  async #hydrateExistingProfile(rootHandle, initials, firstName) {
    return this.sessionRuntime.hydrateExistingProfile(rootHandle, initials, firstName);
  }

  async #resolveUserSession(forcePrompt, options = {}) {
    const allowPermissionPrompt = options.allowPermissionPrompt !== false;
    let rootHandle = null;
    let initials = "";
    let firstName = "";
    let savedWorkFolders = await this.storage.getSavedWorkFolders();

    if (!forcePrompt) {
      rootHandle = await this.storage.getSavedRootHandle();
      initials = this.storage.normalizeInitials(await this.storage.getSavedInitials());
      firstName = this.storage.normalizeFirstName(await this.storage.getSavedFirstName());
      const snapshot = this.persistenceRuntime.getPersistedUserSnapshot();
      if (!firstName && snapshot && snapshot.firstName) {
        firstName = this.storage.normalizeFirstName(snapshot.firstName);
      }
      if (!initials && snapshot && snapshot.initials) {
        initials = this.storage.normalizeInitials(snapshot.initials);
      }

      if (!rootHandle && savedWorkFolders.length) {
        const latestFolder = this.#getMostRecentSavedFolder(savedWorkFolders);
        rootHandle = latestFolder && latestFolder.handle ? latestFolder.handle : null;
      }

      if (rootHandle) {
        const resolvedRoot = await this.#resolveExistingRootHandle(rootHandle, initials, allowPermissionPrompt);
        rootHandle = resolvedRoot.rootHandle;
        if (resolvedRoot.savedWorkFolders) {
          savedWorkFolders = resolvedRoot.savedWorkFolders;
        }
        if (!resolvedRoot.accessible && !allowPermissionPrompt) {
          return {
            rootHandle,
            initials: this.#deriveInitials(rootHandle, initials),
            firstName,
            permissionRequired: true,
          };
        }
      }
      const hydratedProfile = await this.#hydrateExistingProfile(rootHandle, initials, firstName);
      initials = hydratedProfile.initials;
      firstName = hydratedProfile.firstName;

      if (!rootHandle && (firstName || initials)) {
        return {
          rootHandle: null,
          initials: initials || "USER",
          firstName,
          permissionRequired: true,
        };
      }
    }

    if (forcePrompt || !rootHandle || !firstName) {
      const picked = await this.#promptUserSetup(rootHandle, { initials, firstName, savedWorkFolders });
      if (!picked) return null;
      rootHandle = picked.rootHandle;
      initials = picked.initials;
      firstName = picked.firstName;
    }

    initials = this.#deriveInitials(rootHandle, initials);

    const session = { rootHandle, initials, firstName, permissionRequired: false };
    await this.sessionRuntime.persistResolvedSession(session);
    return session;
  }

  async #loadProgressForSession(session) {
    const loaded = await this.storage.loadProgress(session.rootHandle, session.initials);
    if (loaded) {
      this.model.importProgressObject(loaded);
      this.view.setProgressStatus(`Progression chargée pour ${session.firstName} (${session.initials}).`);
    } else {
      this.model.resetProgress();
      this.view.setProgressStatus(`Nouveau profil ${session.firstName} (${session.initials}) créé.`);
      await this.#saveProgress();
    }

    this.sessionRuntime.syncSessionIdentity(session);

    const currentHash = String(window.location.hash || "").trim();
    if (!currentHash || currentHash === "#home") {
      const fallbackHash = this.persistenceRuntime.buildFallbackHashFromUiState();
      if (fallbackHash && fallbackHash !== currentHash) {
        window.location.hash = fallbackHash;
      }
    }
  }

  #saveProgress() {
    if (!this.userSession) return;

    this.saveQueue = this.saveQueue
      .then(async () => {
        const progressObject = JSON.parse(this.model.exportProgressJson());
        await this.storage.saveProgress(
          this.userSession.rootHandle,
          this.userSession.initials,
          progressObject,
        );
      })
      .catch(() => {
        this.view.setProgressStatus("Erreur de sauvegarde. Vérifiez les permissions du dossier utilisateur.");
      });
  }

  #getCurrentExerciseIdFromView() {
    if (!this.view || !this.view.exerciseToggleDoneBtn) return "";
    return String(this.view.exerciseToggleDoneBtn.getAttribute("data-id") || "").trim();
  }

  #buildWorkFileProfileKey() {
    return this.workFileRuntime.buildWorkFileProfileKey();
  }

  async #refreshExerciseWorkFileState(exerciseId, options = {}) {
    const token = ++this.exerciseWorkFileToken;
    await this.workFileRuntime.refreshExerciseWorkFileState(exerciseId, options);
    if (token !== this.exerciseWorkFileToken) return;
  }

  async #pickWorkFileForCurrentExercise() {
    if (!this.isReady || !this.userSession || !this.storage) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    if (!exerciseId) return;

    if (!this.storage.supportsWorkFilePicker || !this.storage.supportsWorkFilePicker()) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "S\u00e9lection du fichier indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = this.#buildWorkFileProfileKey();
    const expected = await this.storage.getSavedExerciseDownload(profileKey, exerciseId);

    try {
      const handle = await this.storage.pickWorkFile({
        startIn: this.userSession.rootHandle || "downloads",
      });

      if (!handle) {
        await this.#refreshExerciseWorkFileState(exerciseId, {
          statusText: "S\u00e9lection du fichier annul\u00e9e.",
        });
        return;
      }

      await this.storage.setSavedExerciseFile(profileKey, exerciseId, handle);
      const selectedName = handle.name || "fichier s\u00e9lectionn\u00e9";
      const expectedName = expected && expected.fileName ? expected.fileName : "";
      const mismatchText = expectedName && selectedName !== expectedName
        ? ` Attention, le fichier attendu \u00e9tait ${expectedName}.`
        : "";

      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: `Fichier s\u00e9lectionn\u00e9 : ${selectedName}.${mismatchText}`,
      });
    } catch {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "Impossible de s\u00e9lectionner le fichier.",
      });
    }
  }

  async #openWorkFileForCurrentExercise() {
    if (!this.isReady || !this.userSession || !this.storage) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    if (!exerciseId) return;

    if (!this.storage.supportsWorkFilePicker || !this.storage.supportsWorkFilePicker()) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "S\u00e9lection du fichier indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = this.#buildWorkFileProfileKey();
    const entry = await this.storage.getSavedExerciseDownload(profileKey, exerciseId);
    if (!entry || !entry.fileName) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "T\u00e9l\u00e9chargez d'abord le fichier de l'exercice, puis s\u00e9lectionnez-le ici.",
      });
      return;
    }

    await this.storage.touchSavedExerciseDownload(profileKey, exerciseId);
    const canContinue = await this.#showWorkFilePickerReminderModal();
    if (!canContinue) return;
    await this.#pickWorkFileForCurrentExercise();
  }

  #getCanonicalExerciseDownloadFileName(exerciseId, downloadUrl) {
    return this.workFileRuntime.getCanonicalExerciseDownloadFileName(exerciseId, downloadUrl);
  }

  #getDownloadFileNameFromLink(linkEl) {
    return this.workFileRuntime.getDownloadFileNameFromLink(linkEl);
  }

  async #handleExerciseDownloadClick(event, linkEl) {
    if (event) event.preventDefault();
    if (!linkEl) return;

    const href = linkEl.getAttribute("href");
    if (!href) return;

    const fileName = this.#getDownloadFileNameFromLink(linkEl);
    const canContinue = await this.#showDownloadReminderModal(fileName);
    if (!canContinue) return;

    await this.#trackExerciseDownloadFromLink(linkEl);
    this.#openDownloadLink(linkEl);
  }

  #openDownloadLink(linkEl) {
    const href = linkEl.getAttribute("href");
    if (!href) return;

    const downloadName = this.#getDownloadFileNameFromLink(linkEl);
    const target = linkEl.getAttribute("target") || "_blank";
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.rel = linkEl.getAttribute("rel") || "noopener";
    anchor.target = target;
    if (downloadName) anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  #escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async #buildDownloadExistingStatus(fileName) {
    return this.workFileRuntime.buildDownloadExistingStatus(fileName);
  }

  async #trackExerciseDownloadFromLink(linkEl) {
    if (!this.isReady) return;
    await this.workFileRuntime.trackExerciseDownloadFromLink(linkEl);
  }

  #getSaveReminderFolderLabel() {
    return this.workFileRuntime.getSaveReminderFolderLabel();
  }

  #getDefaultSaveReminderFileName() {
    return this.workFileRuntime.getDefaultSaveReminderFileName();
  }

  #getNumberedSaveReminderFileName(exerciseNumber) {
    return this.workFileRuntime.getNumberedSaveReminderFileName(exerciseNumber);
  }

  #getSaveReminderFileName(exerciseId) {
    return this.workFileRuntime.getSaveReminderFileName(exerciseId);
  }

  #setSaveReminderContent({
    title,
    message,
    steps,
    continueLabel = "Continuer",
    existingStatusHtml = "",
    existingStatusImportant = false,
    numberedSteps = true,
  }) {
    this.reminderModalRuntime.setContent({
      title,
      message,
      steps,
      continueLabel,
      existingStatusHtml,
      existingStatusImportant,
      numberedSteps,
    });
  }

  async #showDownloadReminderModal(downloadFileName) {
    const existingStatus = await this.#buildDownloadExistingStatus(downloadFileName);

    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const userFolder = this.saveReminderModal.userFolder;
      const fileName = this.saveReminderModal.fileName;
      const cancelBtn = this.saveReminderModal.cancelBtn;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !userFolder || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      const folderLabel = this.#getSaveReminderFolderLabel();
      const cleanFileName = downloadFileName || "fichier";
      userFolder.textContent = folderLabel;
      fileName.textContent = cleanFileName;
      this.#setSaveReminderContent({
        title: "Avant de t\u00e9l\u00e9charger",
        message: `Pensez \u00e0 enregistrer le fichier dans votre dossier ${folderLabel}.`,
        steps: `
          <li>Le t\u00e9l\u00e9chargement va d\u00e9marrer apr\u00e8s ce message.</li>
          <li>Dans la fen\u00eatre d'enregistrement, choisissez votre dossier utilisateur : <code id="save-reminder-user-folder"></code>.</li>
          <li>Conservez ou retrouvez le fichier <code id="save-reminder-file-name"></code>.</li>
          <li>Ouvrez ensuite le fichier dans ${settings.officeAppName}.</li>
        `,
        continueLabel: "T\u00e9l\u00e9charger",
        existingStatusHtml: existingStatus.html,
        existingStatusImportant: existingStatus.important,
      });

      const nextUserFolder = modal.querySelector("#save-reminder-user-folder");
      const nextFileName = modal.querySelector("#save-reminder-file-name");
      if (nextUserFolder) nextUserFolder.textContent = folderLabel;
      if (nextFileName) nextFileName.textContent = cleanFileName;

      this.reminderModalRuntime.show().then(resolve);
    });
  }

  #showWorkFilePickerReminderModal() {
    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const fileName = this.saveReminderModal.fileName;
      const cancelBtn = this.saveReminderModal.cancelBtn;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      fileName.textContent = "T\u00e9l\u00e9chargements";
      this.#setSaveReminderContent({
        title: "Avant de choisir le fichier",
        message: "Pensez \u00e0 v\u00e9rifier dans le dossier \"T\u00e9l\u00e9chargements\" si vous ne voyez pas votre fichier ici.",
        steps: `
          <li>Le s\u00e9lecteur de fichier va s'ouvrir apr\u00e8s ce message.</li>
          <li>Si le fichier n'appara\u00eet pas dans votre dossier utilisateur, regardez aussi dans <code id="save-reminder-file-name"></code>.</li>
        `,
        continueLabel: "Choisir le fichier",
      });

      const nextFileName = modal.querySelector("#save-reminder-file-name");
      if (nextFileName) nextFileName.textContent = "T\u00e9l\u00e9chargements";

      this.reminderModalRuntime.show().then(resolve);
    });
  }

  #showSaveReminderModal(trigger, exerciseId) {
    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const message = this.saveReminderModal.message;
      const userFolder = this.saveReminderModal.userFolder;
      const fileName = this.saveReminderModal.fileName;
      const cancelBtn = this.saveReminderModal.cancelBtn;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !message || !userFolder || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      const folderLabel = this.#getSaveReminderFolderLabel();
      const expectedFileName = this.#getSaveReminderFileName(exerciseId);
      userFolder.textContent = folderLabel;
      fileName.textContent = expectedFileName;
      const isDoneTrigger = trigger === "done";
      const nextReminderSteps = `
          <li><strong>Dans Word</strong><br>
            Si vous n'avez pas d\u00e9j\u00e0 enregistrer votre fichier dans votre dossier
            <ul class="save-reminder-substeps">
              <li>Cliquez sur "Fichier" puis "Enregistrer sous"</li>
              <li>Choisissez Parcourir &gt; Documents.</li>
              <li>Puis votre dossier utilisateur : ${this.#escapeHtml(folderLabel)}.</li>
              <li>Validez avec Enregistrer.</li>
            </ul>
          </li>
          <li>Dans tout les cas terminez par cliquez sur <span class="word-close-icon" aria-hidden="true" title="Fermer">\u00d7</span> (fermer).</li>
        `;
      const doneReminderSteps = `
          <li>Dans Word, cliquez <span class="word-close-icon" aria-hidden="true" title="Fermer">\u00d7</span> (fermer) ou sur <strong>Fichier</strong> puis <strong>Enregistrer sous</strong>.</li>
          <li>Choisissez votre dossier utilisateur : <code id="save-reminder-user-folder"></code>.</li>
          <li>Nommez le fichier <code id="save-reminder-file-name"></code>, puis validez avec <strong>Enregistrer</strong>.</li>
          <li>Dans Word, cliquez <span class="word-close-icon" aria-hidden="true" title="Fermer">\u00d7</span> (fermer) si besoin.</li>
        `;
      this.#setSaveReminderContent({
        title: "Vous avez termin\u00e9 ?",
        message: isDoneTrigger
          ? "Pensez \u00e0 enregistrer votre travail dans votre dossier avant de marquer l'exercice comme fait."
          : "Pensez \u00e0 enregistrer votre travail dans votre dossier avant de passer \u00e0 l'exercice suivant.",
        steps: isDoneTrigger ? doneReminderSteps : nextReminderSteps,
        numberedSteps: isDoneTrigger,
      });
      const nextUserFolder = modal.querySelector("#save-reminder-user-folder");
      const nextFileName = modal.querySelector("#save-reminder-file-name");
      if (nextUserFolder) nextUserFolder.textContent = folderLabel;
      if (nextFileName) nextFileName.textContent = expectedFileName;

      this.reminderModalRuntime.show().then(resolve);
    });
  }

  #promptUserSetup(initialRootHandle, defaults = {}) {
    return this.userSetupRuntime.show(initialRootHandle, defaults);

  }
}

  ;
}

window.createAtelierController = createAtelierController;
})();
