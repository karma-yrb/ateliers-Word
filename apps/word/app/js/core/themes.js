(() => {
function createAtelierThemesRuntime(config = {}) {
  const persistenceRuntime = config.persistenceRuntime;
  const view = config.view;
  const model = config.model;
  const getCurrentThemeId = typeof config.getCurrentThemeId === "function"
    ? config.getCurrentThemeId
    : () => null;
  const setCurrentThemeId = typeof config.setCurrentThemeId === "function"
    ? config.setCurrentThemeId
    : () => {};
  const setCurrentAffinityId = typeof config.setCurrentAffinityId === "function"
    ? config.setCurrentAffinityId
    : () => {};

  return {
    renderOverview() {
      persistenceRuntime.persistUiState({ page: "themes" });
      view.showPage("themes");
      const groups = model.getThemeAffinityGroups().map((group) => {
        const totalExercises = group.themes.reduce(
          (sum, theme) => sum + model.getExercisesByTheme(theme.id).length,
          0,
        );
        const completedExercises = group.themes.reduce((sum, theme) => {
          const themeDone = model
            .getExercisesByTheme(theme.id)
            .filter((exercise) => model.getIsDone(exercise.id)).length;
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

      view.renderAffinityOverview({ groups });
    },

    renderAffinityPage(affinityId, themeId) {
      const groups = model.getThemeAffinityGroups();
      if (!groups.length) {
        view.showPage("affinity");
        view.renderAffinityPage({
          affinity: { id: "", label: "Categorie", subtitle: "" },
          cards: [],
        });
        return { affinityId: "", themeId: null };
      }

      let affinity = groups.find((group) => group.id === affinityId) || null;
      if (!affinity) {
        affinity = groups[0];
      }
      setCurrentAffinityId(affinity.id);

      let currentThemeId = getCurrentThemeId();
      const themeIds = new Set(affinity.themes.map((theme) => theme.id));
      if (themeId && themeIds.has(themeId)) {
        currentThemeId = themeId;
      } else if (!themeId) {
        currentThemeId = null;
      } else if (!currentThemeId || !themeIds.has(currentThemeId)) {
        currentThemeId = null;
      }
      setCurrentThemeId(currentThemeId);

      const cards = affinity.themes.map((theme) => {
        const exercises = model.getExercisesByTheme(theme.id);
        const rows = exercises.map((exercise) => ({
          id: exercise.id,
          num: exercise.num,
          title: exercise.title,
          done: model.getIsDone(exercise.id),
        }));
        const done = rows.filter((row) => row.done).length;
        return {
          id: theme.id,
          name: theme.name,
          rows,
          done,
          total: rows.length,
          percent: rows.length ? Math.round((done / rows.length) * 100) : 0,
          open: theme.id === currentThemeId,
        };
      });

      persistenceRuntime.persistUiState({
        page: "affinity",
        affinityId: affinity.id,
        themeId: currentThemeId || "",
      });
      view.showPage("affinity");
      view.renderAffinityPage({
        affinity: {
          id: affinity.id,
          label: affinity.label,
          subtitle: affinity.subtitle,
        },
        cards,
      });

      return {
        affinityId: affinity.id,
        themeId: currentThemeId,
      };
    },
  };
}

window.createAtelierThemesRuntime = createAtelierThemesRuntime;
})();
