(() => {
function createAtelierUiEventsRuntime(config = {}) {
  const view = config.view;
  const model = config.model;
  const isReady = typeof config.isReady === "function" ? config.isReady : () => false;
  const ensureReady = typeof config.ensureReady === "function" ? config.ensureReady : async () => false;
  const getCurrentAffinityId = typeof config.getCurrentAffinityId === "function"
    ? config.getCurrentAffinityId
    : () => "";
  const getCurrentThemeId = typeof config.getCurrentThemeId === "function"
    ? config.getCurrentThemeId
    : () => "";
  const getDefaultThemeId = typeof config.getDefaultThemeId === "function" ? config.getDefaultThemeId : () => "";
  const saveProgress = typeof config.saveProgress === "function" ? config.saveProgress : () => {};
  const renderFromHash = typeof config.renderFromHash === "function" ? config.renderFromHash : () => {};
  const renderExercise = typeof config.renderExercise === "function" ? config.renderExercise : () => {};
  const showSaveReminder = typeof config.showSaveReminder === "function" ? config.showSaveReminder : async () => true;
  const pickWorkFile = typeof config.pickWorkFile === "function" ? config.pickWorkFile : async () => {};
  const openWorkFile = typeof config.openWorkFile === "function" ? config.openWorkFile : async () => {};
  const handleDownloadClick = typeof config.handleDownloadClick === "function"
    ? config.handleDownloadClick
    : () => {};
  const getUserSession = typeof config.getUserSession === "function" ? config.getUserSession : () => null;
  const setUserSession = typeof config.setUserSession === "function" ? config.setUserSession : () => {};
  const setReady = typeof config.setReady === "function" ? config.setReady : () => {};
  const resolveUserSession = typeof config.resolveUserSession === "function"
    ? config.resolveUserSession
    : async () => null;
  const activateSession = typeof config.activateSession === "function" ? config.activateSession : async () => {};
  const storage = config.storage;
  const setHash = typeof config.setHash === "function"
    ? config.setHash
    : (hash) => {
      window.location.hash = hash;
    };

  return {
    bindExerciseNavigationEvents() {
      for (const btn of view.navButtons) {
        btn.addEventListener("click", async () => {
          const page = btn.getAttribute("data-nav");
          if (!isReady() && page !== "home") {
            const ready = await ensureReady();
            if (!ready) {
              setHash("#home");
              return;
            }
          }
          if (page === "home") setHash("#home");
          if (page === "themes") setHash("#themes");
          if (page === "progress") setHash("#progress");
          if (page === "profile") setHash("#profile");
        });
      }

      document.getElementById("home-start-btn").addEventListener("click", async () => {
        if (!isReady()) {
          const ready = await ensureReady();
          if (!ready) return;
        }
        const resume = model.getResumeExercise();
        if (resume) {
          setHash(`#exercise/${resume.id}`);
        } else {
          const preferredThemeId = getCurrentThemeId() || getDefaultThemeId();
          const first = preferredThemeId ? model.getExercisesByTheme(preferredThemeId)[0] : null;
          setHash(first ? `#exercise/${first.id}` : "#themes");
        }
      });

      document.getElementById("exercise-back-btn").addEventListener("click", async () => {
        if (!isReady()) {
          const ready = await ensureReady();
          if (!ready) return;
        }
        const affinityId = getCurrentAffinityId();
        if (affinityId) {
          setHash(`#affinity/${affinityId}/${getCurrentThemeId() || ""}`);
        } else {
          setHash("#themes");
        }
      });

      document.getElementById("affinity-back-btn").addEventListener("click", async () => {
        if (!isReady()) {
          const ready = await ensureReady();
          if (!ready) return;
        }
        setHash("#themes");
      });

      view.exercisePrevBtn.addEventListener("click", async () => {
        if (!isReady()) {
          const ready = await ensureReady();
          if (!ready) return;
        }
        const targetId = view.exercisePrevBtn.getAttribute("data-target-id");
        if (targetId) setHash(`#exercise/${targetId}`);
      });

      view.exerciseNextBtn.addEventListener("click", async () => {
        if (!isReady()) {
          const ready = await ensureReady();
          if (!ready) return;
        }
        const currentId = view.exerciseToggleDoneBtn.getAttribute("data-id");
        const wasDone = currentId ? model.getIsDone(currentId) : false;
        if (currentId && !wasDone) {
          const canContinue = await showSaveReminder("next", currentId);
          if (!canContinue) return;
        }

        if (currentId && !wasDone) {
          model.markExerciseDone(currentId, true);
          saveProgress();
        }
        const targetId = view.exerciseNextBtn.getAttribute("data-target-id");
        if (targetId) setHash(`#exercise/${targetId}`);
      });

      view.exerciseToggleDoneBtn.addEventListener("click", async () => {
        if (!isReady()) {
          const ready = await ensureReady();
          if (!ready) return;
        }
        const id = view.exerciseToggleDoneBtn.getAttribute("data-id");
        if (!id) return;
        const isExerciseDone = model.getIsDone(id);

        if (!isExerciseDone) {
          const canContinue = await showSaveReminder("done", id);
          if (!canContinue) return;
        }

        model.markExerciseDone(id, !isExerciseDone);
        saveProgress();
        renderExercise(id);
      });

      if (view.exercisePickWorkFileBtn) {
        view.exercisePickWorkFileBtn.addEventListener("click", async () => {
          await pickWorkFile();
        });
      }

      if (view.exerciseOpenWorkFileBtn) {
        view.exerciseOpenWorkFileBtn.addEventListener("click", async () => {
          await openWorkFile();
        });
      }

      if (view.exerciseWorkFileBtn) {
        view.exerciseWorkFileBtn.addEventListener("click", (event) => {
          handleDownloadClick(event, view.exerciseWorkFileBtn);
        });
      }

      if (view.exerciseDownloadBtn) {
        view.exerciseDownloadBtn.addEventListener("click", (event) => {
          handleDownloadClick(event, view.exerciseDownloadBtn);
        });
      }
    },

    bindUserAccountEvents() {
      const changeBtn = document.getElementById("progress-change-user-btn");
      if (changeBtn) {
        changeBtn.addEventListener("click", async () => {
          const session = await resolveUserSession(true, { allowPermissionPrompt: true });
          if (!session) return;
          await activateSession(session, { render: isReady() });
        });
      }

      const resetBtn = document.getElementById("progress-reset-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          if (!isReady()) return;
          const ok = window.confirm("Reinitialiser toute la progression de cet utilisateur ?");
          if (!ok) return;
          model.resetProgress();
          saveProgress();
          view.setProgressStatus("Progression reinitialisee (profil conserve).");
          renderFromHash();
        });
      }

      const resetProfileBtn = document.getElementById("progress-reset-profile-btn");
      if (resetProfileBtn) {
        resetProfileBtn.addEventListener("click", async () => {
          const userSession = getUserSession();
          if (!userSession) return;
          const ok = window.confirm(
            "Supprimer le prenom et le dossier de reference sur cet appareil ? La progression enregistree dans le dossier utilisateur ne sera pas supprimee.",
          );
          if (!ok) return;

          await storage.deleteUserProfile(userSession.rootHandle, userSession.initials);
          await storage.clearSavedSession();

          setUserSession(null);
          setReady(false);
          model.resetProgress();
          view.setHeaderUser("", "");
          view.setProgressUserPath("Aucun utilisateur selectionne.");
          view.setProgressStatus("Profil local supprime. Reconfiguration en cours...");

          const session = await resolveUserSession(true, { allowPermissionPrompt: true });
          if (!session) {
            view.setProgressStatus("Profil local supprime. Configuration utilisateur annulee.");
            view.showPage("home");
            return;
          }

          await activateSession(session, { render: true });
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
        headerUserBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          const isOpen = !headerUserMenu.hidden;
          if (isOpen) {
            closeUserMenu();
          } else {
            headerUserMenu.hidden = false;
            headerUserBtn.setAttribute("aria-expanded", "true");
          }
        });
        document.addEventListener("click", closeUserMenu);
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") closeUserMenu();
        });
        const headerSwitchBtn = document.getElementById("header-user-switch-btn");
        if (headerSwitchBtn) {
          headerSwitchBtn.addEventListener("click", async () => {
            closeUserMenu();
            const session = await resolveUserSession(true, { allowPermissionPrompt: true });
            if (!session) return;
            await activateSession(session, { render: isReady() });
          });
        }
        const headerProfileBtn = document.getElementById("header-user-profile-btn");
        if (headerProfileBtn) {
          headerProfileBtn.addEventListener("click", async () => {
            closeUserMenu();
            if (!isReady()) {
              const ready = await ensureReady();
              if (!ready) return;
            }
            setHash("#profile");
          });
        }
      }
    },

    bindDynamicEvents() {
      const onAction = async (event) => {
        if (!isReady()) {
          const ready = await ensureReady();
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
          setHash(`#affinity/${affinityId}`);
          return;
        }

        if (action === "toggle-theme") {
          const themeId = actionEl.getAttribute("data-theme-id");
          const affinityId = actionEl.getAttribute("data-affinity-id") || getCurrentAffinityId();
          if (!themeId || !affinityId) return;
          const sameThemeOpen = getCurrentThemeId() === themeId;
          const nextHash = sameThemeOpen ? `#affinity/${affinityId}` : `#affinity/${affinityId}/${themeId}`;
          setHash(nextHash);
          return;
        }

        const id = actionEl.getAttribute("data-id");
        if (!id) return;

        if (action === "open-exercise") {
          setHash(`#exercise/${id}`);
          return;
        }

        if (action === "toggle-done") {
          const isExerciseDone = model.getIsDone(id);
          model.markExerciseDone(id, !isExerciseDone);
          saveProgress();
          renderFromHash();
        }
      };

      const onActionKeydown = (event) => {
        if (!isReady()) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains("exercise-row")) return;
        const action = target.getAttribute("data-action");
        const id = target.getAttribute("data-id");
        if (action !== "open-exercise" || !id) return;
        event.preventDefault();
        setHash(`#exercise/${id}`);
      };

      view.themesAffinityList.addEventListener("click", onAction);
      view.affinityThemeList.addEventListener("click", onAction);
      view.affinityThemeList.addEventListener("keydown", onActionKeydown);
    },
  };
}

window.createAtelierUiEventsRuntime = createAtelierUiEventsRuntime;
})();
