(() => {
function formatDay(isoDay) {
  const parts = String(isoDay || "").split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

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
  }

  init() {
    this.#bindStaticEvents();
    this.#bindDynamicEvents();
    window.addEventListener("hashchange", () => {
      this.#persistCurrentHash();
      if (this.isReady) this.#renderFromHash();
    });

    if (!window.location.hash) {
      const restoredHash = this.#getPersistedHash();
      window.location.hash = restoredHash || "#home";
    }

    this.#bootstrap().catch(() => {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Erreur d'initialisation utilisateur.");
      this.view.showPage("home");
    });
  }

  async #bootstrap() {
    if (!this.storage || !this.storage.isSupported()) {
      const snapshot = this.#getPersistedUserSnapshot();
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
      const snapshot = this.#getPersistedUserSnapshot();
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
      this.view.exerciseDocxBtn.addEventListener("click", (event) => {
        this.#handleExerciseDownloadClick(event, this.view.exerciseDocxBtn);
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

  #persistCurrentHash() {
    try {
      const currentHash = String(window.location.hash || "").trim();
      if (!currentHash) return;
      window.localStorage.setItem(this.routeStorageKey, currentHash);
    } catch {
      // LocalStorage indisponible: on continue sans persistance de navigation
    }
  }

  #getPersistedHash() {
    try {
      const stored = String(window.localStorage.getItem(this.routeStorageKey) || "").trim();
      if (!stored.startsWith("#")) return "";
      return stored;
    } catch {
      return "";
    }
  }

  #persistUiState(state) {
    try {
      if (!state || typeof state !== "object") return;
      window.localStorage.setItem(this.uiStateStorageKey, JSON.stringify(state));
    } catch {
      // LocalStorage indisponible: on continue sans persistance de vue
    }
  }

  #getPersistedUiState() {
    try {
      const raw = window.localStorage.getItem(this.uiStateStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  #persistUserSnapshot(snapshot) {
    try {
      if (!snapshot || typeof snapshot !== "object") return;
      window.localStorage.setItem(this.userSnapshotStorageKey, JSON.stringify({
        firstName: String(snapshot.firstName || "").trim(),
        initials: String(snapshot.initials || "").trim(),
        folderName: String(snapshot.folderName || "").trim(),
      }));
    } catch {
      // LocalStorage indisponible: on continue sans snapshot utilisateur
    }
  }

  #getPersistedUserSnapshot() {
    try {
      const raw = window.localStorage.getItem(this.userSnapshotStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? {
            firstName: String(parsed.firstName || "").trim(),
            initials: String(parsed.initials || "").trim(),
            folderName: String(parsed.folderName || "").trim(),
          }
        : null;
    } catch {
      return null;
    }
  }

  #buildFallbackHashFromUiState() {
    const state = this.#getPersistedUiState();
    if (!state) return "";

    if (state.page === "exercise" && state.exerciseId) {
      const exercise = this.model.getExerciseById(state.exerciseId);
      if (exercise) return `#exercise/${exercise.id}`;
    }

    if (state.page === "affinity" && state.affinityId) {
      if (state.themeId) {
        const theme = this.model.getThemeById(state.themeId);
        if (theme && this.model.getAffinityIdForTheme(theme.id) === state.affinityId) {
          return `#affinity/${state.affinityId}/${theme.id}`;
        }
      }
      return `#affinity/${state.affinityId}`;
    }

    if (state.page === "themes" || state.page === "progress" || state.page === "profile" || state.page === "home") {
      return `#${state.page}`;
    }

    return "";
  }

  #renderHomePage() {
    this.#persistUiState({ page: "home" });
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
    this.#persistUiState({ page: "themes" });
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

    this.#persistUiState({
      page: "affinity",
      affinityId: affinity.id,
      themeId: this.currentThemeId || "",
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
    this.#persistUiState({
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
    this.#persistUiState({ page: "progress" });
    this.view.showPage("progress");
    const summary = this.model.getSummary();
    const curveSeries = this.model.getCurveSeries(30);
    this.view.renderProgress({ ...summary, curveSeries });
  }

  // FIX 2 — Page Profil : affiche les infos utilisateur et permet de modifier le prénom inline.
  // Prérequis HTML : <div id="profile-user-section"></div> dans #page-profile.
  #renderProfilePage() {
    this.#persistUiState({ page: "profile" });
    this.view.showPage("profile");
    if (!this.userSession) return;

    const profileSection = document.getElementById("profile-user-section");
    if (!profileSection) return;

    const folderName = this.userSession.rootHandle && this.userSession.rootHandle.name
      ? this.userSession.rootHandle.name
      : "Dossier utilisateur";
    let currentFirstName = this.userSession.firstName || "";
    const initials = this.userSession.initials || "";

    const esc = (v) => String(v || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    profileSection.innerHTML = `
      <p class="profile-info-line"><strong>Prénom :</strong> <span id="profile-firstname-display">${esc(currentFirstName)}</span></p>
      <p class="profile-info-line"><strong>Initiales :</strong> ${esc(initials)}</p>
      <p class="profile-info-line"><strong>Dossier :</strong> ${esc(folderName)}</p>
      <div id="profile-rename-wrap" style="display:none;margin-top:0.75rem;">
        <label for="profile-firstname-input" style="display:block;margin-bottom:0.35rem;font-size:0.9rem;">Nouveau prénom :</label>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
          <input id="profile-firstname-input" type="text" maxlength="30" placeholder="Ex: Alice"
            style="flex:1;min-width:140px;padding:0.4rem 0.6rem;border:1px solid #bbb;border-radius:6px;font-size:0.95rem;">
          <button id="profile-firstname-save-btn" class="btn" type="button">Enregistrer</button>
          <button id="profile-firstname-cancel-btn" class="btn btn-secondary" type="button">Annuler</button>
        </div>
        <p id="profile-rename-status" style="margin-top:0.4rem;font-size:0.85rem;color:#555;"></p>
      </div>
      <button id="profile-edit-firstname-btn" class="btn" type="button" style="margin-top:0.75rem;">Modifier le prénom</button>
    `;

    const editBtn      = document.getElementById("profile-edit-firstname-btn");
    const renameWrap   = document.getElementById("profile-rename-wrap");
    const input        = document.getElementById("profile-firstname-input");
    const saveBtn      = document.getElementById("profile-firstname-save-btn");
    const cancelBtn    = document.getElementById("profile-firstname-cancel-btn");
    const renameStatus = document.getElementById("profile-rename-status");
    const display      = document.getElementById("profile-firstname-display");

    editBtn.addEventListener("click", () => {
      input.value = currentFirstName;
      renameWrap.style.display = "";
      editBtn.style.display = "none";
      renameStatus.textContent = "";
      input.focus();
      input.select();
    });

    cancelBtn.addEventListener("click", () => {
      renameWrap.style.display = "none";
      editBtn.style.display = "";
    });

    const doSave = async () => {
      const newName = this.storage.normalizeFirstName(input.value);
      if (!newName) {
        renameStatus.textContent = "Le prénom ne peut pas être vide.";
        input.focus();
        return;
      }
      try {
        await this.storage.saveUserProfile(
          this.userSession.rootHandle,
          this.userSession.initials,
          newName,
        );
        await this.storage.setSavedFirstName(newName);
        this.userSession = { ...this.userSession, firstName: newName };
        currentFirstName = newName;
        this.view.setHeaderUser(newName, this.userSession.initials);
        display.textContent = newName;
        renameWrap.style.display = "none";
        editBtn.style.display = "";
      } catch {
        renameStatus.textContent = "Erreur lors de l'enregistrement.";
      }
    };

    saveBtn.addEventListener("click", doSave);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); doSave(); }
      if (e.key === "Escape") { e.preventDefault(); cancelBtn.click(); }
    });
  }

  #deriveInitials(rootHandle, fallback = "") {
    const fromFallback = this.storage.normalizeInitials(fallback);
    if (fromFallback) return fromFallback;
    const fromFolderName = this.storage.normalizeInitials(rootHandle && rootHandle.name ? rootHandle.name : "");
    if (fromFolderName) return fromFolderName;
    return "USER";
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
      this.userSession = session;
      await this.#loadProgressForSession(session);
      this.isReady = true;
      this.#renderFromHash();
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
      const snapshot = this.#getPersistedUserSnapshot();
      if (!firstName && snapshot && snapshot.firstName) {
        firstName = this.storage.normalizeFirstName(snapshot.firstName);
      }
      if (!initials && snapshot && snapshot.initials) {
        initials = this.storage.normalizeInitials(snapshot.initials);
      }

      if (!rootHandle && savedWorkFolders.length) {
        const orderedFolders = [...savedWorkFolders].sort((a, b) => {
          const left = Date.parse(a.lastUsedAt || "") || 0;
          const right = Date.parse(b.lastUsedAt || "") || 0;
          return right - left;
        });
        rootHandle = orderedFolders[0].handle || null;
      }

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

    await this.storage.ensureProgressDirectory(rootHandle, initials, true);
    await this.storage.saveUserProfile(rootHandle, initials, firstName);
    await this.storage.addSavedWorkFolder(rootHandle);
    await this.storage.setSavedRootHandle(rootHandle);
    await this.storage.setSavedInitials(initials);
    await this.storage.setSavedFirstName(firstName);
    this.#persistUserSnapshot({
      firstName,
      initials,
      folderName: rootHandle && rootHandle.name ? rootHandle.name : "",
    });

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
    this.view.setProgressUserPath(`Fichier: ${rootName} > ProgressionAtelier > ${settings.progressFileName}`);
    this.#persistUserSnapshot({
      firstName: session.firstName,
      initials: session.initials,
      folderName: rootName,
    });

    const currentHash = String(window.location.hash || "").trim();
    if (!currentHash || currentHash === "#home") {
      const fallbackHash = this.#buildFallbackHashFromUiState();
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
    if (!this.userSession || !this.userSession.initials) return "USER";
    if (!this.storage || !this.storage.normalizeProfileKey) return String(this.userSession.initials).trim() || "USER";
    return this.storage.normalizeProfileKey(this.userSession.initials);
  }

  async #refreshExerciseWorkFileState(exerciseId, options = {}) {
    if (!this.view || !this.view.setExerciseWorkFileState) return;
    const token = ++this.exerciseWorkFileToken;
    const filePickerSupported = Boolean(
      this.storage
      && this.storage.supportsWorkFilePicker
      && this.storage.supportsWorkFilePicker(),
    );

    if (!exerciseId || !this.userSession || !filePickerSupported) {
      this.view.setExerciseWorkFileState({
        pickerSupported: filePickerSupported,
        openVisible: false,
        statusText: filePickerSupported ? "" : "S\u00e9lection du fichier indisponible sur ce navigateur.",
      });
      return;
    }

    const profileKey = this.#buildWorkFileProfileKey();
    const entry = await this.storage.getSavedExerciseDownload(profileKey, exerciseId);
    const selectedFile = this.storage.getSavedExerciseFile
      ? await this.storage.getSavedExerciseFile(profileKey, exerciseId)
      : null;
    if (token !== this.exerciseWorkFileToken) return;

    const fileName = selectedFile && selectedFile.fileName
      ? selectedFile.fileName
      : entry && entry.fileName ? entry.fileName : "";

    this.view.setExerciseWorkFileState({
      pickerSupported: filePickerSupported,
      openVisible: Boolean(fileName),
      fileName,
      statusText: options.statusText || "",
    });
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

  #getDownloadFileName(downloadUrl) {
    try {
      const parsed = new URL(String(downloadUrl || ""), window.location.href);
      const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(lastSegment) || "fichier-telecharge";
    } catch {
      return "fichier-telecharge";
    }
  }

  #getDownloadFileNameFromLink(linkEl) {
    if (!linkEl) return "fichier-telecharge";
    const suggestedName = String(linkEl.getAttribute("download") || "").trim();
    if (suggestedName) return suggestedName;
    return this.#getDownloadFileName(linkEl.getAttribute("href"));
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

    const downloadName = String(linkEl.getAttribute("download") || "").trim();
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

  async #fileExistsInDirectory(directoryHandle, fileName) {
    if (!directoryHandle || directoryHandle.kind !== "directory" || !fileName) return null;
    try {
      if (this.storage && this.storage.queryDirectoryPermission) {
        const allowed = await this.storage.queryDirectoryPermission(directoryHandle, "read");
        if (!allowed) return null;
      }
      await directoryHandle.getFileHandle(fileName, { create: false });
      return true;
    } catch {
      return false;
    }
  }

  async #buildDownloadExistingStatus(fileName) {
    const folderLabel = this.#getSaveReminderFolderLabel();
    const userFolderExists = await this.#fileExistsInDirectory(
      this.userSession && this.userSession.rootHandle,
      fileName,
    );

    if (userFolderExists !== true) {
      return {
        important: false,
        html: "",
      };
    }

    return {
      important: true,
      html: `
        <strong>Attention</strong><br>
        ${this.#escapeHtml(`Le fichier existe d\u00e9j\u00e0 dans votre dossier ${folderLabel}.`)}
      `,
    };
  }

  async #trackExerciseDownloadFromLink(linkEl) {
    if (!this.isReady || !this.userSession || !this.storage || !linkEl) return;
    const exerciseId = this.#getCurrentExerciseIdFromView();
    const href = linkEl.getAttribute("href");
    if (!exerciseId || !href) return;

    const fileName = this.#getDownloadFileNameFromLink(linkEl);
    await this.storage.setSavedExerciseDownload(this.#buildWorkFileProfileKey(), exerciseId, fileName, href);
    await this.#refreshExerciseWorkFileState(exerciseId, {
      statusText: `T\u00e9l\u00e9chargement lanc\u00e9. Ouvrez le document dans ${settings.officeAppName}, cliquez sur "Activer la modification", enregistrez ${fileName} dans votre dossier utilisateur, puis cliquez sur "S\u00e9lectionner mon fichier".`,
    });
  }

  #getSaveReminderFolderLabel() {
    if (!this.userSession || !this.userSession.rootHandle) {
      return "Dossier utilisateur";
    }
    return this.userSession.rootHandle.name || "Dossier utilisateur";
  }

  #getDefaultSaveReminderFileName() {
    return `exercice-termine.${settings.completedFileExtension}`;
  }

  #getNumberedSaveReminderFileName(exerciseNumber) {
    return `ex-${String(exerciseNumber).padStart(3, "0")}-termine.${settings.completedFileExtension}`;
  }

  #getSaveReminderFileName(exerciseId) {
    if (!exerciseId) return this.#getDefaultSaveReminderFileName();
    const normalized = String(exerciseId).trim().toLowerCase();
    const normalizedMatch = normalized.match(/^ex-(\d+)$/);
    if (normalizedMatch) {
      return `ex-${String(normalizedMatch[1]).padStart(3, "0")}-termine.${settings.completedFileExtension}`;
    }
    const exercise = this.model.getExerciseById(exerciseId);
    if (!exercise || typeof exercise.num !== "number") return this.#getDefaultSaveReminderFileName();
    return this.#getNumberedSaveReminderFileName(exercise.num);
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
    const modal = this.saveReminderModal.root;
    const titleEl = modal ? modal.querySelector("#save-reminder-title") : null;
    const stepsEl = modal ? modal.querySelector(".save-reminder-steps") : null;
    const existingStatus = this.saveReminderModal.existingStatus;
    const continueBtn = this.saveReminderModal.continueBtn;

    if (titleEl) titleEl.textContent = title;
    if (this.saveReminderModal.message) this.saveReminderModal.message.textContent = message;
    if (stepsEl) {
      stepsEl.innerHTML = steps;
      stepsEl.classList.toggle("is-unnumbered", !numberedSteps);
    }
    if (existingStatus) {
      existingStatus.hidden = !existingStatusHtml;
      existingStatus.innerHTML = existingStatusHtml;
      existingStatus.classList.toggle("is-important", Boolean(existingStatusImportant));
    }
    if (continueBtn) continueBtn.textContent = continueLabel;
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

      const onClose = (result) => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        if (cancelBtn) cancelBtn.onclick = null;
        continueBtn.onclick = null;
        window.removeEventListener("keydown", onKeydown);
        resolve(result);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose(false);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onClose(true);
        }
      };

      if (cancelBtn) cancelBtn.onclick = () => onClose(false);
      continueBtn.onclick = () => onClose(true);
      window.addEventListener("keydown", onKeydown);
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      continueBtn.focus();
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

      const onClose = (result) => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        if (cancelBtn) cancelBtn.onclick = null;
        continueBtn.onclick = null;
        window.removeEventListener("keydown", onKeydown);
        resolve(result);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose(false);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onClose(true);
        }
      };

      if (cancelBtn) cancelBtn.onclick = () => onClose(false);
      continueBtn.onclick = () => onClose(true);
      window.addEventListener("keydown", onKeydown);
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      continueBtn.focus();
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

      const onClose = (result) => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        if (cancelBtn) cancelBtn.onclick = null;
        continueBtn.onclick = null;
        window.removeEventListener("keydown", onKeydown);
        resolve(result);
      };

      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose(false);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onClose(true);
        }
      };

      if (cancelBtn) cancelBtn.onclick = () => onClose(false);
      continueBtn.onclick = () => onClose(true);
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
          status.textContent = hasScannedDocuments
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

      // FIX 1 — Le champ prénom est toujours éditable, même si un profil existant est trouvé.
      // L'ancienne logique mettait le champ en readOnly quand profile.firstName était renseigné,
      // ce qui empêchait toute correction du prénom depuis la modal de setup.
      const setFirstNameEditMode = (canEdit) => {
        firstNameInput.readOnly = !canEdit;
        if (canEdit) {
          firstNameInput.removeAttribute("aria-readonly");
          firstNameInput.placeholder = "Ex: Alice";
        } else {
          firstNameInput.setAttribute("aria-readonly", "true");
          firstNameInput.placeholder = "Prénom du dossier";
        }
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
            // FIX 1a — toujours éditable, même si un prénom est déjà enregistré
            setFirstNameEditMode(true);
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
          resolvedInitials = this.#deriveInitials(rootHandle, "");
          const profile = await this.storage.loadUserProfile(rootHandle, resolvedInitials, false);
          if (profile) {
            const profileInitials = this.storage.normalizeInitials(profile.initials);
            if (profileInitials) resolvedInitials = profileInitials;
            if (profile.firstName) {
              firstNameInput.value = profile.firstName;
              // FIX 1b — toujours éditable, même si un prénom est déjà enregistré
              setFirstNameEditMode(true);
            } else {
              // Profil sans prénom : champ vide et éditable.
              firstNameInput.value = "";
              setFirstNameEditMode(true);
            }
          } else {
            // Aucun profil pour ce dossier : champ vide et éditable.
            // On n'utilise pas defaultFirstName qui appartient à l'ancien utilisateur.
            firstNameInput.value = "";
            setFirstNameEditMode(true);
          }
          setFirstNameVisibility(true);
          setValidateVisibility(true);
          updateFolderStatus();
        } catch {
          setValidateVisibility(false);
          status.textContent = "Impossible d'ouvrir ce dossier. Sélectionnez-en un autre.";
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
            // FIX 1c — toujours éditable, même si un prénom est déjà enregistré
            setFirstNameEditMode(true);
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

  ;
}

window.createAtelierController = createAtelierController;
})();
