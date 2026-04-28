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
    this.saveQueue = Promise.resolve();

    this.userModal = {
      root: document.getElementById("user-setup-modal"),
      status: document.getElementById("user-setup-status"),
      pickBtn: document.getElementById("user-setup-pick-root-btn"),
      firstNameInput: document.getElementById("user-setup-firstname-input"),
      validateBtn: document.getElementById("user-setup-validate-btn"),
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

    const session = await this.#resolveUserSession(false);
    if (!session) {
      this.view.setHeaderUser("", "");
      this.view.setProgressStatus("Aucun utilisateur configuré.");
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
      btn.addEventListener("click", () => {
        const page = btn.getAttribute("data-nav");
        if (page === "home") window.location.hash = "#home";
        if (page === "themes") window.location.hash = "#themes";
        if (page === "progress") window.location.hash = "#progress";
        if (page === "profile") window.location.hash = "#profile";
      });
    }

    document.getElementById("home-start-btn").addEventListener("click", () => {
      if (!this.isReady) return;
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

    document.getElementById("exercise-back-btn").addEventListener("click", () => {
      if (!this.isReady) return;
      if (this.currentAffinityId) {
        window.location.hash = `#affinity/${this.currentAffinityId}/${this.currentThemeId || ""}`;
      } else {
        window.location.hash = "#themes";
      }
    });

    document.getElementById("affinity-back-btn").addEventListener("click", () => {
      if (!this.isReady) return;
      window.location.hash = "#themes";
    });

    this.view.exercisePrevBtn.addEventListener("click", () => {
      if (!this.isReady) return;
      const targetId = this.view.exercisePrevBtn.getAttribute("data-target-id");
      if (targetId) window.location.hash = `#exercise/${targetId}`;
    });

    this.view.exerciseNextBtn.addEventListener("click", () => {
      if (!this.isReady) return;
      const currentId = this.view.exerciseToggleDoneBtn.getAttribute("data-id");
      if (currentId && !this.model.getIsDone(currentId)) {
        this.model.markExerciseDone(currentId, true);
        this.#saveProgress();
      }
      const targetId = this.view.exerciseNextBtn.getAttribute("data-target-id");
      if (targetId) window.location.hash = `#exercise/${targetId}`;
    });

    this.view.exerciseToggleDoneBtn.addEventListener("click", () => {
      if (!this.isReady) return;
      const id = this.view.exerciseToggleDoneBtn.getAttribute("data-id");
      if (!id) return;
      const isDone = this.model.getIsDone(id);
      this.model.markExerciseDone(id, !isDone);
      this.#saveProgress();
      this.#renderExercisePage(id);
    });

    const changeBtn = document.getElementById("progress-change-user-btn");
    if (changeBtn) {
      changeBtn.addEventListener("click", async () => {
        const session = await this.#resolveUserSession(true);
        if (!session) return;
        this.userSession = session;
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

        const session = await this.#resolveUserSession(true);
        if (!session) {
          this.view.setProgressStatus("Profil local supprimé. Configuration utilisateur annulée.");
          this.view.showPage("home");
          return;
        }

        this.userSession = session;
        await this.#loadProgressForSession(session);
        this.isReady = true;
        this.#renderFromHash();
      });
    }

    const headerUserBtn = document.getElementById("header-user-badge");
    if (headerUserBtn) {
      headerUserBtn.addEventListener("click", () => {
        if (!this.isReady) return;
        window.location.hash = "#profile";
      });
    }
  }

  #bindDynamicEvents() {
    const onAction = (event) => {
      if (!this.isReady) return;
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
    });
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

  async #resolveUserSession(forcePrompt) {
    let rootHandle = null;
    let initials = "";
    let firstName = "";

    if (!forcePrompt) {
      rootHandle = await this.storage.getSavedRootHandle();
      initials = this.storage.normalizeInitials(await this.storage.getSavedInitials());
      firstName = this.storage.normalizeFirstName(await this.storage.getSavedFirstName());
      if (rootHandle) {
        let ok = await this.storage.ensureWritePermission(rootHandle);
        if (ok) {
          rootHandle = await this.storage.resolveUserRootHandle(rootHandle, initials);
          ok = await this.storage.ensureWritePermission(rootHandle);
        }
        if (!ok) rootHandle = null;
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

    if (!rootHandle || !firstName) {
      const picked = await this.#promptUserSetup(rootHandle, { initials, firstName });
      if (!picked) return null;
      rootHandle = picked.rootHandle;
      initials = picked.initials;
      firstName = picked.firstName;
    }

    initials = this.#deriveInitials(rootHandle, initials);

    await this.storage.ensureProgressDirectory(rootHandle, initials, true);
    await this.storage.saveUserProfile(rootHandle, initials, firstName);
    await this.storage.setSavedRootHandle(rootHandle);
    await this.storage.setSavedInitials(initials);
    await this.storage.setSavedFirstName(firstName);

    return { rootHandle, initials, firstName };
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

  #promptUserSetup(initialRootHandle, defaults = {}) {
    return new Promise((resolve) => {
      const modal = this.userModal.root;
      const status = this.userModal.status;
      const pickBtn = this.userModal.pickBtn;
      const firstNameInput = this.userModal.firstNameInput;
      const validate = this.userModal.validateBtn;

      if (!modal || !status || !pickBtn || !firstNameInput || !validate) {
        resolve(null);
        return;
      }

      let rootHandle = initialRootHandle || null;
      let resolvedInitials = this.#deriveInitials(rootHandle, defaults.initials);
      const defaultFirstName = this.storage.normalizeFirstName(defaults.firstName);

      const closeModal = (result) => {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
        pickBtn.onclick = null;
        validate.onclick = null;
        firstNameInput.onkeydown = null;
        resolve(result);
      };

      const updateFolderStatus = () => {
        if (!rootHandle) {
          status.textContent = "Choisissez le dossier utilisateur avant de valider.";
          return;
        }
        status.textContent = `Dossier sélectionné: ${rootHandle.name || "dossier utilisateur"}.`;
      };

      pickBtn.onclick = async () => {
        try {
          rootHandle = await this.storage.pickUserDirectory();
          const ok = await this.storage.ensureWritePermission(rootHandle);
          if (!ok) {
            rootHandle = null;
            status.textContent = "Permission refusée sur ce dossier. Rechoisissez un dossier utilisateur.";
            return;
          }

          resolvedInitials = this.#deriveInitials(rootHandle, "");
          const profile = await this.storage.loadUserProfile(rootHandle, resolvedInitials, false);
          if (profile) {
            const profileInitials = this.storage.normalizeInitials(profile.initials);
            if (profileInitials) {
              resolvedInitials = profileInitials;
            }
            if (!this.storage.normalizeFirstName(firstNameInput.value) && profile.firstName) {
              firstNameInput.value = profile.firstName;
            }
          }

          updateFolderStatus();
        } catch {
          status.textContent = "Sélection de dossier annulée.";
        }
      };

      const validateSelection = async () => {
        if (!rootHandle) {
          status.textContent = "Choisissez le dossier utilisateur avant de valider.";
          return;
        }

        const initials = this.#deriveInitials(rootHandle, resolvedInitials);

        const firstName = this.storage.normalizeFirstName(firstNameInput.value);
        if (!firstName) {
          status.textContent = "Votre prénom est obligatoire.";
          firstNameInput.focus();
          return;
        }

        try {
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
      firstNameInput.value = defaultFirstName || "";
      updateFolderStatus();
      firstNameInput.focus();
    });
  }
}

window.WordAtelierController = WordAtelierController;
