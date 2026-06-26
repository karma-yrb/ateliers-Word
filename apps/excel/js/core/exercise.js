(() => {
function createAtelierExerciseRuntime(config = {}) {
  const persistenceRuntime = config.persistenceRuntime;
  const view = config.view;
  const model = config.model;
  const storage = config.storage;
  const getCurrentAffinityId = typeof config.getCurrentAffinityId === "function"
    ? config.getCurrentAffinityId
    : () => null;
  const setCurrentThemeId = typeof config.setCurrentThemeId === "function"
    ? config.setCurrentThemeId
    : () => {};
  const setCurrentAffinityId = typeof config.setCurrentAffinityId === "function"
    ? config.setCurrentAffinityId
    : () => {};
  const saveProgress = typeof config.saveProgress === "function" ? config.saveProgress : () => {};
  const refreshWorkFileState = typeof config.refreshWorkFileState === "function"
    ? config.refreshWorkFileState
    : () => {};
  const renderAffinityFallback = typeof config.renderAffinityFallback === "function"
    ? config.renderAffinityFallback
    : () => {};
  const renderThemesFallback = typeof config.renderThemesFallback === "function"
    ? config.renderThemesFallback
    : () => {};

  return {
    render(exerciseId) {
      const exercise = model.getExerciseById(exerciseId);
      if (!exercise) {
        const currentAffinityId = getCurrentAffinityId();
        if (currentAffinityId) {
          renderAffinityFallback();
        } else {
          renderThemesFallback();
        }
        return false;
      }

      const currentThemeId = exercise.moduleId;
      const currentAffinityId = model.getAffinityIdForTheme(exercise.moduleId) || getCurrentAffinityId();
      setCurrentThemeId(currentThemeId);
      setCurrentAffinityId(currentAffinityId);

      persistenceRuntime.persistUiState({
        page: "exercise",
        exerciseId: exercise.id,
        affinityId: currentAffinityId || "",
        themeId: currentThemeId || "",
      });
      if (model.markExerciseOpened(exercise.id)) {
        saveProgress();
      }
      view.showPage("exercise");

      const done = model.getIsDone(exercise.id);
      const stepsVm = model.getExerciseStepsView
        ? model.getExerciseStepsView(exercise)
        : { preamble: "", steps: model.getStepsForExercise(exercise) };
      const visuals = model.getVisualsForExercise(exercise);
      const { prevId, nextId } = model.getNeighbors(exercise.id);
      view.renderExercise({
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
          pickerSupported: Boolean(
            storage && storage.supportsWorkFilePicker && storage.supportsWorkFilePicker(),
          ),
        },
      });
      refreshWorkFileState(exercise.id);
      return true;
    },
  };
}

window.createAtelierExerciseRuntime = createAtelierExerciseRuntime;
})();
