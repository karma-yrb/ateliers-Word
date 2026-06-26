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
  const saveProgress = typeof config.saveProgress === "function" ? config.saveProgress : () => {};
  const renderFromHash = typeof config.renderFromHash === "function" ? config.renderFromHash : () => {};
  const setHash = typeof config.setHash === "function"
    ? config.setHash
    : (hash) => {
      window.location.hash = hash;
    };

  return {
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
