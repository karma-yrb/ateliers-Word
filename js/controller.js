function formatDay(isoDay) {
  const parts = String(isoDay || "").split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

class WordAtelierController {
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
      continueBtn: document.getElementById("save-reminder-continue-btn"),
    };
  }

  init() {
    this.#bindStaticEvents();
    this.#bindDynamicEvents();
    window.addEventListener("hashchange", () => {
      if (this.isReady) this.#renderFromHash();
    });

    if (!window.location.hash) {
      window.location.hash = "#home";
    }

    this.#bootstrap().catch(() => {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Erreur d'initialisation utilisateur.");
      this.view.showPage("home");
    });
  }

  async #bootstrap() {
    if (!this.storage || !this.storage.isSupported()) {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Ce navigateur ne permet pas la sauvegarde automatique locale (utiliser Edge/Chrome récents).");
      this.view.showPage("home");
      return;
    }

    const session = await this.#resolveUserSession(false, { allowPermissionPrompt: false });
    if (!session) {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Aucun utilisateur configuré.");
      this.view.showPage("home");
      return;
    }
    if (session.permissionRequired) {
      this.pendingPermissionSession = session;
      this.view.setHeaderUser(session.firstName || "", session.initials || "");
      this.view.setProgressStatus("Accès dossier requis. Cliquez sur « Commencer maintenant » pour autoriser l'accès.");
      this.view.showPage("home");
      return;
    }

    this.userSession = session;
    await this.#loadProgressForSession(session);
    this.isReady = true;
    this.#renderFromHash();
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

    if (this.view.exerciseDocxBtn) {
      this.view.exerciseDocxBtn.addEventListener("click", () => {
        void this.#trackExerciseDownloadFromLink(this.view.exerciseDocxBtn);
      });
    }

    if (this.view.exerciseDownloadBtn) {
      this.view.exerciseDownloadBtn.addEventListener("click", () => {
        void this.#trackExerciseDownloadFromLink(this.view.exerciseDownloadBtn);
      });
    }

    const changeBtn = document.getElementById("progress-change-user-btn");
    if (changeBtn) {
      changeBtn.addEventListener("click", async () => {
        const session = await this.#resolveUserSession(true, { allowPermissionPrompt: true });
        if (!session) return;
        this.userSession = session;
        this.pendingPermissionSession = null;
        await this.#loadProgressForSession(session);
        if (this.isReady) this.#renderFromHash();
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

        this.userSession = session;
        this.pendingPermissionSession = null;
        await this.#loadProgressForSession(session);
        this.isReady = true;
        this.#renderFromHash();
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
          this.userSession = session;
          this.pendingPermissionSession = null;
          await this.#loadProgressForSession(session);
          if (this.isReady) this.#renderFromHash();
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
    this.view.showPage("home");
    const summary = this.model.getSummary();
    const lastExercise = this.model.getLastExercise();
    const resumeExercise = this.model.getResumeExercise();
    let lastDoneText = "Pas encore terminé.";
    if (lastExercise) {
      const done = this.model.getIsDone(lastExercise.id);
      if (done) {
        const day = this.model.getLastCompletedDate(lastExercise.id);
        lastDoneText = day ? `Fait le ${formatDay(day)}.` : "Dernier exercice marqué comme fait.";
      } else {
        lastDoneText = "Dernier exercice ouvert.";
      }
    }

    let startLabel = "Commencer maintenant";
    let startTheme = "Aucun thème sélectionné";
    let startExercise = "Choisissez votre premier exercice";
    let startHelp = "Lance automatiquement le prochain exercice conseillé.";
    if (resumeExercise && summary.completed > 0) {
      startLabel = `Continuer : Exercice ${resumeExercise.num}`;
      startTheme = resumeExercise.moduleName;
      startExercise = `Exercice ${resumeExercise.num} - ${resumeExercise.title}`;
      startHelp = `${resumeExercise.title} (${resumeExercise.moduleName})`;
    } else if (resumeExercise) {
      startLabel = `Démarrer : Exercice ${resumeExercise.num}`;
      startTheme = resumeExercise.moduleName;
      startExercise = `Exercice ${resumeExercise.num} - ${resumeExercise.title}`;
      startHelp = `${resumeExercise.title} (${resumeExercise.moduleName})`;
    }

    this.view.renderHome({
      ...summary,
      lastExercise,
      lastDoneText,
      startLabel,
      startTheme,
      startExercise,
      startHelp,
    });
  }

  #renderThemesOverview() {
    this.view.showPage("themes");
    const groups = this.model.getThemeAffinityGroups().map((group) => {
      const totalExercises = group.themes.reduce(
        (sum, theme) => sum + this.model.getExercisesByTheme(theme.id).length,
        0,
      );
      const completedExercises = group.themes.reduce((sum, theme) => {
        const themeDone = this.model
          .getExercisesByTheme(theme.id)
          .filter((exercise) => this.model.getIsDone(exercise.id)).length;
        return sum + themeDone;
      }, 0);
      return {
        id: group.id,
        label: group.label,
        subtitle: group.subtitle,
        totalExercises,
        completedExercises,
        percent: totalExercises ? Math.round((completedExercises / totalExercises) * 100) : 0,
      };
    });

    this.view.renderAffinityOverview({ groups });
  }

  #renderAffinityPage(affinityId, themeId) {
    const groups = this.model.getThemeAffinityGroups();
    if (!groups.length) {
      this.view.showPage("affinity");
      this.view.renderAffinityPage({
        affinity: { id: "", label: "Catégorie", subtitle: "" },
        cards: [],
      });
      return;
    }

    let affinity = groups.find((g) => g.id === affinityId) || null;
    if (!affinity) {
      affinity = groups[0];
    }
    this.currentAffinityId = affinity.id;

    const themeIds = new Set(affinity.themes.map((theme) => theme.id));
    if (themeId && themeIds.has(themeId)) {
      this.currentThemeId = themeId;
    } else if (!themeId) {
      this.currentThemeId = null;
    } else if (!this.currentThemeId || !themeIds.has(this.currentThemeId)) {
      this.currentThemeId = null;
    }

    const cards = affinity.themes.map((theme) => {
      const exercises = this.model.getExercisesByTheme(theme.id);
      const rows = exercises.map((ex) => ({
        id: ex.id,
        num: ex.num,
        title: ex.title,
        done: this.model.getIsDone(ex.id),
      }));
      const done = rows.filter((row) => row.done).length;
      return {
        id: theme.id,
        name: theme.name,
        rows,
        done,
        total: rows.length,
        percent: rows.length ? Math.round((done / rows.length) * 100) : 0,
        open: theme.id === this.currentThemeId,
      };
    });

    this.view.showPage("affinity");
    this.view.renderAffinityPage({
      affinity: {
        id: affinity.id,
        label: affinity.label,
        subtitle: affinity.subtitle,
      },
      cards,
    });
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
    if (this.model.markExerciseOpened(exercise.id)) {
      this.#saveProgress();
    }
    this.view.showPage("exercise");

    const done = this.model.getIsDone(exercise.id);
    const steps = this.model.getStepsForExercise(exercise);
    const visuals = this.model.getVisualsForExercise(exercise);
    const { prevId, nextId } = this.model.getNeighbors(exercise.id);
    this.view.renderExercise({
      exercise,
      done,
      steps,
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
    this.view.showPage("progress");
    const summary = this.model.getSummary();
    const curveSeries = this.model.getCurveSeries(30);
    this.view.renderProgress({ ...summary, curveSeries });
  }

  #renderProfilePage() {
    this.view.showPage("profile");
  }

  #deriveInitials(rootHandle, fallback = "") {
    const fromFallback = this.storage.normalizeInitials(fallback);
    if (fromFallback) return fromFallback;
    const fromFolderName = this.storage.normalizeInitials(rootHandle && rootHandle.name ? rootHandle.name : "");
    if (fromFolderName) return fromFolderName;
    return "USER";
  }

  async #resumePendingSessionFromUserGesture() {
    if (!this.pendingPermissionSession || !this.pendingPermissionSession.rootHandle) return false;

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

    this.pendingPermissionSession = null;
    this.userSession = session;
    await this.#loadProgressForSession(session);
    this.isReady = true;
    this.#renderFromHash();
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

    this.userSession = session;
    this.pendingPermissionSession = null;
    await this.#loadProgressForSession(session);
    this.isReady = true;
    return true;
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
      if (rootHandle) {
        let ok = allowPermissionPrompt
          ? await this.storage.ensureWritePermission(rootHandle)
          : await this.storage.queryDirectoryPermission(rootHandle, "readwrite");
        if (ok) {
          rootHandle = await this.storage.resolveUserRootHandle(rootHandle, initials);
          ok = allowPermissionPrompt
            ? await this.storage.ensureWritePermission(rootHandle)
            : await this.storage.queryDirectoryPermission(rootHandle, "readwrite");
        }
        if (!ok && !allowPermissionPrompt) {
          return {
            rootHandle,
            initials: this.#deriveInitials(rootHandle, initials),
            firstName,
            permissionRequired: true,
          };
        }
        if (!ok) rootHandle = null;
        if (ok && rootHandle) {
          savedWorkFolders = await this.storage.addSavedWorkFolder(rootHandle);
        }
      }

      if (rootHandle && (!initials || !firstName)) {
        const profile = await this.storage.loadUserProfile(
          rootHandle,
          this.#deriveInitials(rootHandle, initials),
          false,
        );
        if (profile) {
          if (!initials && profile.initials) {
            initials = this.storage.normalizeInitials(profile.initials);
          }
          if (!firstName && profile.firstName) {
            firstName = this.storage.normalizeFirstName(profile.firstName);
          }
        }
      }

      if (rootHandle && !initials) {
        initials = this.#deriveInitials(rootHandle, "");
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

    await this.storage.ensureProgressDirectory(rootHandle, initials, true);
    await this.storage.saveUserProfile(rootHandle, initials, firstName);
    await this.storage.addSavedWorkFolder(rootHandle);
    await this.storage.setSavedRootHandle(rootHandle);
    await this.storage.setSavedInitials(initials);
    await this.storage.setSavedFirstName(firstName);

    return { rootHandle, initials, firstName, permissionRequired: false };
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

    this.view.setHeaderUser(session.firstName, session.initials);
    const rootName = session.rootHandle && session.rootHandle.name ? session.rootHandle.name : "Dossier choisi";
    this.view.setProgressUserPath(`Fichier: ${rootName} > ProgressionAtelier > progression-word.json`);
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
    if (!this.userSession || !this.userSession.initials) return "USER";
    if (!this.storage || !this.storage.normalizeProfileKey) return String(this.userSession.initials).trim() || "USER";
    return this.storage.normalizeProfileKey(this.userSession.initials);
  }

  async #refreshExerciseWorkFileState(exerciseId, options = {}) {
    if (!this.view || !this.view.setExerciseWorkFileState) return;
    const token = ++this.exerciseWorkFileToken;
    const folderAccessSupported = Boolean(
      this.storage
      && this.storage.isSupported
      && this.storage.isSupported(),
    );

    if (!exerciseId || !this.userSession || !folderAccessSupported) {
      this.view.setExerciseWorkFileState({
        pickerSupported: folderAccessSupported,
        openVisible: false,
        statusText: folderAccessSupported ? "" : "Ouverture du dossier utilisateur indisponible sur ce navigateur.",
      });
      return;
    }

    const entry = await this.storage.getSavedExerciseDownload(this.#buildWorkFileProfileKey(), exerciseId);
    if (token !== this.exerciseWorkFileToken) return;

    this.view.setExerciseWorkFileState({
      pickerSupported: folderAccessSupported,
      openVisible: Boolean(entry && entry.fileName),
      fileName: entry && entry.fileName ? entry.fileName : "",
      statusText: options.statusText || "",
    });
  }

  async #pickWorkFileForCurrentExercise() {
    return;
  }

  async #openWorkFileForCurrentExercise() {
    if (!this.isReady || !this.userSession || !this.storage) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    if (!exerciseId) return;

    if (!this.storage.isSupported || !this.storage.isSupported()) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "Ouverture du dossier utilisateur indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = this.#buildWorkFileProfileKey();
    const entry = await this.storage.getSavedExerciseDownload(profileKey, exerciseId);
    if (!entry || !entry.fileName) {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "Téléchargez d'abord le fichier de l'exercice, puis enregistrez-le dans votre dossier utilisateur.",
      });
      return;
    }

    try {
      const handle = await this.storage.openUserDirectory(this.userSession.rootHandle);

      if (!handle) {
        await this.#refreshExerciseWorkFileState(exerciseId, {
          statusText: `Dossier utilisateur prêt : ${this.userSession.rootHandle && this.userSession.rootHandle.name ? this.userSession.rootHandle.name : "dossier utilisateur"}.`,
        });
        return;
      }

      const ok = await this.storage.ensureDirectoryPermission(handle, "readwrite");
      if (!ok) {
        await this.#refreshExerciseWorkFileState(exerciseId, {
          statusText: "Permission refusée pour ce dossier utilisateur.",
        });
        return;
      }

      await this.storage.touchSavedExerciseDownload(profileKey, exerciseId);
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: `Dossier ouvert : ${handle.name || "dossier utilisateur"}. Cherchez ${entry.fileName}.`,
      });
    } catch {
      await this.#refreshExerciseWorkFileState(exerciseId, {
        statusText: "Impossible d'ouvrir le dossier utilisateur.",
      });
    }
  }

  #getDownloadFileName(downloadUrl) {
    try {
      const parsed = new URL(String(downloadUrl || ""), window.location.href);
      const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(lastSegment) || "fichier-telecharge";
    } catch {
      return "fichier-telecharge";
    }
  }

  async #trackExerciseDownloadFromLink(linkEl) {
    if (!this.isReady || !this.userSession || !this.storage || !linkEl) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    const href = linkEl.getAttribute("href");
    if (!exerciseId || !href) return;

    const fileName = this.#getDownloadFileName(href);
    await this.storage.setSavedExerciseDownload(this.#buildWorkFileProfileKey(), exerciseId, fileName, href);
    await this.#refreshExerciseWorkFileState(exerciseId, {
      statusText: `Téléchargement lancé. Ouvrez le document dans Word, cliquez sur « Activer la modification », enregistrez ${fileName} dans votre dossier utilisateur, puis cliquez sur « Ouvrir mon fichier ».`,
    });
  }

  #getSaveReminderFolderLabel() {
    if (!this.userSession || !this.userSession.rootHandle) {
      return "Dossier utilisateur";
    }
    return this.userSession.rootHandle.name || "Dossier utilisateur";
  }

  #getSaveReminderFileName(exerciseId) {
    if (!exerciseId) return "exercice-termine.docx";
    const normalized = String(exerciseId).trim().toLowerCase();
    if (/^ex-\d+$/.test(normalized)) {
      return `${normalized}-termine.docx`;
    }
    const exercise = this.model.getExerciseById(exerciseId);
    if (!exercise || typeof exercise.num !== "number") return "exercice-termine.docx";
    return `ex-${String(exercise.num).padStart(3, "0")}-termine.docx`;
  }

  #showSaveReminderModal(trigger, exerciseId) {
    return new Promise((resolve) => {
      const modal = this.saveReminderModal.root;
      const message = this.saveReminderModal.message;
      const userFolder = this.saveReminderModal.userFolder;
      const fileName = this.saveReminderModal.fileName;
      const continueBtn = this.saveReminderModal.continueBtn;

      if (!modal || !message || !userFolder || !fileName || !continueBtn) {
        resolve(true);
        return;
      }

      const folderLabel = this.#getSaveReminderFolderLabel();
      userFolder.textContent = folderLabel;
      fileName.textContent = this.#getSaveReminderFileName(exerciseId);
      message.textContent = trigger === "done"
        ? "Pensez à enregistrer votre travail dans votre dossier avant de marquer l'exercice comme fait."
        : "Pensez à enregistrer votre travail dans votre dossier avant de passer à l'exercice suivant.";

      const onClose = () => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        continueBtn.onclick = null;
        window.removeEventListener("keydown", onKeydown);
        resolve(true);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          event.preventDefault();
          onClose();
        }
      };

      continueBtn.onclick = () => onClose();
      window.addEventListener("keydown", onKeydown);
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      continueBtn.focus();
    });
  }

  #promptUserSetup(initialRootHandle, defaults = {}) {
    return new Promise((resolve) => {
      const modal = this.userModal.root;
      const status = this.userModal.status;
      const savedFoldersWrap = this.userModal.savedFoldersWrap;
      const savedFoldersSelect = this.userModal.savedFoldersSelect;
      const pickBtn = this.userModal.pickBtn;
      const firstNameInput = this.userModal.firstNameInput;
      const firstNameLabel = modal.querySelector('label[for="user-setup-firstname-input"]');
      const cancel = this.userModal.cancelBtn;
      const validate = this.userModal.validateBtn;

      if (!modal || !status || !pickBtn || !firstNameInput || !validate) {
        resolve(null);
        return;
      }

      let rootHandle = initialRootHandle || null;
      let resolvedInitials = this.#deriveInitials(rootHandle, defaults.initials);
      const defaultFirstName = this.storage.normalizeFirstName(defaults.firstName);
      let savedFolders = Array.isArray(defaults.savedWorkFolders) ? defaults.savedWorkFolders.slice() : [];
      let selectedSavedId = "";
      let pickBtnMode = "hidden";

      const closeModal = (result) => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        pickBtn.onclick = null;
        if (cancel) cancel.onclick = null;
        validate.onclick = null;
        firstNameInput.onkeydown = null;
        if (savedFoldersSelect) savedFoldersSelect.onchange = null;
        resolve(result);
      };

      if (cancel) {
        cancel.onclick = () => {
          status.textContent = "Configuration annulée.";
          closeModal(null);
        };
      }

      const setFirstNameVisibility = (visible) => {
        const displayValue = visible ? "" : "none";
        if (firstNameLabel) firstNameLabel.style.display = displayValue;
        firstNameInput.style.display = displayValue;
      };

      const setValidateVisibility = (visible) => {
        validate.style.display = visible ? "" : "none";
      };

      const updateFolderStatus = () => {
        if (!rootHandle) {
          setValidateVisibility(false);
          status.textContent = savedFolders.length > 0
            ? "Choisissez un dossier de travail dans la liste ci-dessous."
            : "Cliquez sur le bouton ci-dessous pour accéder à vos dossiers dans Documents.";
          return;
        }
        setValidateVisibility(true);
        status.textContent = `Dossier sélectionné : ${rootHandle.name || "dossier utilisateur"}.`;
      };

      const setPickButtonMode = (mode = "hidden") => {
        pickBtnMode = mode;

        if (mode === "pick-folder") {
          pickBtn.style.display = "";
          pickBtn.textContent = "Choisir votre dossier de travail";
          pickBtn.setAttribute("data-icon", "📂");
          return;
        }

        if (mode === "add-folder") {
          pickBtn.style.display = "";
          pickBtn.textContent = "Choisir un autre dossier";
          pickBtn.setAttribute("data-icon", "📂");
          return;
        }

        pickBtn.style.display = "none";
      };

      const setFirstNameEditMode = (canEdit) => {
        // Le champ est toujours éditable : l'utilisateur doit pouvoir corriger
        // ou changer son prénom même si un profil existant a été chargé.
        firstNameInput.readOnly = false;
        firstNameInput.removeAttribute("aria-readonly");
        firstNameInput.placeholder = canEdit ? "Ex: Alice" : "Modifier si besoin";
      };

      const renderSavedFolders = () => {
        if (!savedFoldersWrap || !savedFoldersSelect) return;
        if (!savedFolders.length) {
          savedFoldersWrap.style.display = "none";
          savedFoldersSelect.innerHTML = "";
          return;
        }

        savedFoldersWrap.style.display = "";
        const ordered = [...savedFolders].sort((a, b) => {
          const left = Date.parse(a.lastUsedAt || "") || 0;
          const right = Date.parse(b.lastUsedAt || "") || 0;
          return right - left;
        });

        savedFoldersSelect.innerHTML = "";
        for (const folder of ordered) {
          const option = document.createElement("option");
          option.value = folder.id;
          option.textContent = folder.name || "Dossier de travail";
          savedFoldersSelect.appendChild(option);
        }

        const currentIds = new Set(ordered.map((folder) => folder.id));
        if (!selectedSavedId || !currentIds.has(selectedSavedId)) {
          selectedSavedId = ordered[0].id;
        }
        savedFoldersSelect.value = selectedSavedId;
      };

      const findSavedFolderIdByHandle = async (handle) => {
        if (!handle) return "";
        for (const folder of savedFolders) {
          try {
            if (await folder.handle.isSameEntry(handle)) return folder.id;
          } catch {
            if (folder.name === (handle.name || folder.name)) return folder.id;
          }
        }
        return "";
      };

      const mergeSavedFolders = async (incomingFolders) => {
        if (!Array.isArray(incomingFolders) || !incomingFolders.length) return savedFolders;
        const merged = savedFolders.slice();

        for (const incoming of incomingFolders) {
          const handle = incoming && incoming.handle;
          if (!handle || handle.kind !== "directory") continue;

          let existing = null;
          for (const folder of merged) {
            try {
              if (await folder.handle.isSameEntry(handle)) {
                existing = folder;
                break;
              }
            } catch {
              if (folder.name === (handle.name || folder.name)) {
                existing = folder;
                break;
              }
            }
          }

          if (existing) {
            existing.handle = handle;
            existing.name = handle.name || existing.name || "Dossier de travail";
            continue;
          }

          merged.push({
            id: String(incoming.id || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            name: String(incoming.name || handle.name || "Dossier de travail").trim() || "Dossier de travail",
            handle,
            lastUsedAt: typeof incoming.lastUsedAt === "string" ? incoming.lastUsedAt : "",
          });
        }

        savedFolders = merged;
        return savedFolders;
      };

      const applySavedFolderSelection = async (folderId, options = {}) => {
        const requestPermission = options.requestPermission !== false;
        const folder = savedFolders.find((entry) => entry.id === folderId);
        if (!folder) return;
        selectedSavedId = folderId;
        rootHandle = folder.handle || null;
        resolvedInitials = this.#deriveInitials(rootHandle, "");
        firstNameInput.value = "";
        setFirstNameVisibility(false);

        if (!requestPermission) {
          const profile = await this.storage.loadUserProfile(rootHandle, resolvedInitials, false);
          if (profile && profile.firstName) {
            firstNameInput.value = profile.firstName;
            setFirstNameEditMode(false);
          } else {
            // Pas de profil connu pour ce dossier : champ vide et éditable.
            // On n'utilise pas defaultFirstName qui appartient à l'ancien utilisateur.
            firstNameInput.value = "";
            setFirstNameEditMode(true);
          }
          setFirstNameVisibility(true);
          setValidateVisibility(true);
          updateFolderStatus();
          return;
        }

        // Tente d'obtenir la permission FS. Si ce n'est pas possible (pas de geste
        // utilisateur explicite, handle périmé, etc.), on bascule en mode dégradé :
        // le prénom est chargé depuis IndexedDB et la permission réelle sera demandée
        // au clic sur Valider — exactement comme pour requestPermission: false.
        let permissionOk = false;
        try {
          let selectedHandle = rootHandle;
          let ok = await this.storage.ensureWritePermission(selectedHandle);
          if (ok) {
            selectedHandle = await this.storage.resolveUserRootHandle(selectedHandle, resolvedInitials);
            ok = await this.storage.ensureWritePermission(selectedHandle);
          }
          if (ok) {
            rootHandle = selectedHandle;
            resolvedInitials = this.#deriveInitials(rootHandle, "");
            permissionOk = true;
          }
        } catch {
          // Pas de permission immédiate (pas de geste utilisateur) — mode dégradé.
          permissionOk = false;
        }

        // Chargement du profil : depuis le FS si permission obtenue,
        // sinon tentative quand même (loadUserProfile est robuste aux erreurs).
        let profile = null;
        try {
          profile = await this.storage.loadUserProfile(rootHandle, resolvedInitials, false);
        } catch {
          profile = null;
        }

        if (profile) {
          const profileInitials = this.storage.normalizeInitials(profile.initials);
          if (profileInitials) resolvedInitials = profileInitials;
          if (profile.firstName) {
            firstNameInput.value = profile.firstName;
            setFirstNameEditMode(false);
          } else {
            firstNameInput.value = "";
            setFirstNameEditMode(true);
          }
        } else {
          firstNameInput.value = "";
          setFirstNameEditMode(true);
        }

        setFirstNameVisibility(true);
        setValidateVisibility(true);
        // En mode dégradé, on informe discrètement que la permission sera demandée à la validation.
        if (!permissionOk) {
          status.textContent = rootHandle
            ? `Dossier sélectionné : ${rootHandle.name || "dossier utilisateur"}. La permission d'accès sera confirmée à la validation.`
            : "Choisissez un dossier de travail dans la liste ci-dessous.";
        } else {
          updateFolderStatus();
        }
      };

      pickBtn.onclick = async () => {
        const restoreMode = savedFolders.length ? "add-folder" : "pick-folder";
        setPickButtonMode("hidden");
        try {
          const handle = await this.storage.pickUserDirectory();
          if (!handle) {
            setPickButtonMode(restoreMode);
            status.textContent = "Sélection annulée.";
            return;
          }

          const canWrite = await this.storage.ensureWritePermission(handle);
          if (!canWrite) {
            setPickButtonMode(restoreMode);
            status.textContent = "Permission refusée sur ce dossier.";
            return;
          }

          // Résolution : si le dossier contient déjà un sous-dossier unique avec ProgressionAtelier,
          // descendre dedans pour éviter la duplication.
          // Pour un dossier entièrement nouveau, resolveUserRootHandle peut échouer :
          // on reste alors sur le handle sélectionné.
          let resolvedHandle = handle;
          try {
            resolvedHandle = await this.storage.resolveUserRootHandle(handle, "") || handle;
          } catch {
            resolvedHandle = handle;
          }
          if (resolvedHandle !== handle) {
            const ok = await this.storage.ensureWritePermission(resolvedHandle);
            if (!ok) {
              setPickButtonMode(restoreMode);
              status.textContent = "Permission refusée sur ce dossier.";
              return;
            }
          }

          rootHandle = resolvedHandle;
          resolvedInitials = this.#deriveInitials(rootHandle, "");

          const profile = await this.storage.loadUserProfile(rootHandle, resolvedInitials, false);
          if (profile) {
            if (profile.initials) resolvedInitials = this.storage.normalizeInitials(profile.initials);
            firstNameInput.value = profile.firstName || "";
            setFirstNameEditMode(!profile.firstName);
          } else {
            // Nouveau dossier sans profil : champ vide et éditable.
            firstNameInput.value = "";
            setFirstNameEditMode(true);
          }

          await mergeSavedFolders([{
            id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: rootHandle.name || "Dossier de travail",
            handle: rootHandle,
          }]);
          await this.storage.setSavedWorkFolders(savedFolders);
          renderSavedFolders();

          const newId = await findSavedFolderIdByHandle(rootHandle);
          if (newId) {
            selectedSavedId = newId;
            if (savedFoldersSelect) savedFoldersSelect.value = newId;
          }

          setPickButtonMode("add-folder");
          setFirstNameVisibility(true);
          setValidateVisibility(true);
          updateFolderStatus();
          if (!firstNameInput.readOnly) firstNameInput.focus();
        } catch (error) {
          setPickButtonMode(restoreMode);
          if (!error || error.name === "AbortError") {
            status.textContent = "Sélection annulée.";
          } else {
            status.textContent = "Impossible d'ouvrir ce dossier.";
          }
        }
      };

      if (savedFoldersSelect) {
        savedFoldersSelect.onchange = async () => {
          selectedSavedId = savedFoldersSelect.value;
          await applySavedFolderSelection(selectedSavedId);
        };
      }

      const validateSelection = async () => {
        if (!rootHandle) {
          status.textContent = "Choisissez le dossier utilisateur avant de valider.";
          return;
        }

        const firstName = this.storage.normalizeFirstName(firstNameInput.value);
        if (!firstName) {
          status.textContent = "Votre prénom est obligatoire.";
          firstNameInput.focus();
          return;
        }

        try {
          let selectedHandle = rootHandle;
          let ok = await this.storage.ensureWritePermission(selectedHandle);
          if (ok) {
            selectedHandle = await this.storage.resolveUserRootHandle(selectedHandle, resolvedInitials);
            ok = await this.storage.ensureWritePermission(selectedHandle);
          }
          if (!ok) {
            status.textContent = "Permission refusée sur ce dossier. Sélectionnez-en un autre ou ajoutez-en un nouveau.";
            return;
          }

          rootHandle = selectedHandle;
          const initials = this.#deriveInitials(rootHandle, resolvedInitials);
          resolvedInitials = initials;
          await this.storage.ensureProgressDirectory(rootHandle, initials, true);
          closeModal({ rootHandle, initials, firstName });
        } catch {
          status.textContent = "Impossible de créer/ouvrir le dossier utilisateur.";
        }
      };

      validate.onclick = () => {
        validateSelection();
      };

      firstNameInput.onkeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          validateSelection();
        }
      };

      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      resolvedInitials = this.#deriveInitials(rootHandle, defaults.initials);
      firstNameInput.value = "";
      setFirstNameVisibility(false);
      setValidateVisibility(false);
      setFirstNameEditMode(false);
      // Rendu immédiat sans accès au système de fichiers :
      // les profils connus sont affichés depuis IndexedDB, la permission
      // FS n'est demandée qu'au clic sur Valider (user gesture).
      (async () => {
        renderSavedFolders();
        if (savedFolders.length > 0) {
          setPickButtonMode("add-folder");
          if (rootHandle) {
            selectedSavedId = await findSavedFolderIdByHandle(rootHandle);
          }
          if (!selectedSavedId && savedFoldersSelect && savedFoldersSelect.value) {
            selectedSavedId = savedFoldersSelect.value;
          }
          if (selectedSavedId) {
            if (savedFoldersSelect) savedFoldersSelect.value = selectedSavedId;
            // requestPermission: false → utilise le prénom caché dans IndexedDB,
            // pas d'accès FS. La permission réelle est demandée sur clic Valider.
            await applySavedFolderSelection(selectedSavedId, { requestPermission: false });
          } else {
            updateFolderStatus();
          }
        } else {
          setPickButtonMode("pick-folder");
          updateFolderStatus();
        }
        if (firstNameInput.style.display !== "none") {
          firstNameInput.focus();
        }
      })();
    });
  }
}

window.WordAtelierController = WordAtelierController;