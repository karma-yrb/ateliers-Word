function dayString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDate(value) {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dayString(dt);
}

function uniqueStrings(items) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter((v) => typeof v === "string" && v.trim()))];
}

function cleanText(value) {
  return String(value || "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanStepText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function foldText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

class WordAtelierModel {
  constructor(rawData) {
    if (!rawData || !Array.isArray(rawData.exercises) || !Array.isArray(rawData.modules)) {
      throw new Error("Données invalides");
    }

    this.themes = rawData.modules
      .map((m) => ({
        id: m.id,
        name: cleanText(m.cleanName || m.name || "Thème"),
        section: m.section || "",
        sectionOrder: toInt(m.sectionOrder, 99),
        orderInSection: toInt(m.orderInSection, 999),
      }))
      .sort((a, b) => {
        if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
        return a.orderInSection - b.orderInSection;
      });

    this.exercises = rawData.exercises
      .map((ex) => ({
        id: ex.id,
        globalIndex: toInt(ex.globalIndex, 0),
        moduleId: ex.moduleId,
        moduleName: cleanText(ex.moduleNameClean || ex.moduleName || "Thème"),
        num: toInt(ex.num, 0),
        title: cleanText(ex.title || `Exercice ${ex.num || ""}`),
        level: toInt(ex.level, 0),
        description: cleanText(ex.description || ""),
        docxUrl: ex.docxUrl || null,
        downloadUrl: ex.downloadUrl || null,
        downloadLabel: cleanText(ex.downloadLabel || ""),
        imageEnonce: ex.imageEnonce || null,
        imageResultat: ex.imageResultat || null,
        imageEnonceCaption: cleanText(ex.imageEnonceCaption || ""),
        imageResultatCaption: cleanText(ex.imageResultatCaption || ""),
        scrapeEnonceImages: uniqueStrings(ex.scrape && ex.scrape.enonceImages),
        scrapeResultImages: uniqueStrings(ex.scrape && ex.scrape.resultImages),
        extraImages: uniqueStrings(
          Array.isArray(ex.extraImages)
            ? ex.extraImages
            : Array.isArray(ex.scrape && ex.scrape.extraImages)
              ? ex.scrape.extraImages
              : [],
        ),
        instructions: Array.isArray(ex.instructions) ? ex.instructions.map((s) => cleanStepText(s)).filter(Boolean) : [],
      }))
      .sort((a, b) => a.globalIndex - b.globalIndex);

    this.exById = new Map(this.exercises.map((ex) => [ex.id, ex]));
    this.exByTheme = new Map();
    for (const theme of this.themes) {
      this.exByTheme.set(
        theme.id,
        this.exercises.filter((ex) => ex.moduleId === theme.id).sort((a, b) => a.num - b.num),
      );
    }
    this.themes = this.themes.filter((theme) => (this.exByTheme.get(theme.id) || []).length > 0);

    this.progress = this.#emptyProgress();
  }

  #emptyProgress() {
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      completedIds: [],
      lastExerciseId: null,
      history: [],
    };
  }

  #loadProgress() {
    return this.#emptyProgress();
  }

  #saveProgress() {
    this.progress.updatedAt = new Date().toISOString();
  }

  #sanitizeProgress() {
    this.progress.completedIds = this.progress.completedIds.filter((id) => this.exById.has(id));
    this.progress.history = this.progress.history.filter((h) => this.exById.has(h.exerciseId));
    if (!this.progress.lastExerciseId || !this.exById.has(this.progress.lastExerciseId)) {
      this.progress.lastExerciseId = this.#findLatestCompletedFromHistory();
    }
    this.#saveProgress();
  }

  #findLatestCompletedFromHistory() {
    const doneSet = new Set(this.progress.completedIds);
    for (let i = this.progress.history.length - 1; i >= 0; i -= 1) {
      const h = this.progress.history[i];
      if (h.delta > 0 && doneSet.has(h.exerciseId)) return h.exerciseId;
    }
    return doneSet.size ? [...doneSet][doneSet.size - 1] : null;
  }

  getThemes() {
    return this.themes.slice();
  }

  getThemeById(themeId) {
    return this.themes.find((t) => t.id === themeId) || null;
  }

  getDefaultAffinityId() {
    const groups = this.getThemeAffinityGroups();
    return groups.length ? groups[0].id : null;
  }

  getAffinityIdForTheme(themeId) {
    const theme = this.getThemeById(themeId);
    return theme ? this.getThemeAffinity(theme).id : null;
  }

  getThemeAffinity(theme) {
    const name = foldText(theme && theme.name);
    const section = String(theme && theme.section || "").toLowerCase();

    if (section === "complets" || name.includes("niveau")) {
      return {
        id: "parcours",
        label: "Parcours guidés",
        subtitle: "Exercices complets classés par niveau.",
        order: 5,
      };
    }

    if (
      /chercher et remplacer|publipostage|lier le document|champs et formulaire/.test(name)
    ) {
      return {
        id: "automatisation",
        label: "Automatisation et production",
        subtitle: "Gagner du temps sur les tâches répétitives et les documents pro.",
        order: 4,
      };
    }

    if (
      /tableau|document long|section et saut|en-tete et pied de page|styles|modeles/.test(name)
    ) {
      return {
        id: "structure",
        label: "Structure du document",
        subtitle: "Construire des documents organisés, lisibles et solides.",
        order: 3,
      };
    }

    if (
      /word art|lettrine|forme|zone de texte|image|format de page|affichage|smart art/.test(name)
    ) {
      return {
        id: "visuel",
        label: "Mise en forme visuelle",
        subtitle: "Travailler l'apparence et l'impact visuel des documents.",
        order: 2,
      };
    }

    return {
      id: "fondations",
      label: "Fondations Word",
      subtitle: "Prendre en main les bases de saisie, paragraphes et organisation simple.",
      order: 1,
    };
  }

  getThemeAffinityGroups() {
    const groupsById = new Map();
    for (const theme of this.themes) {
      const affinity = this.getThemeAffinity(theme);
      if (!groupsById.has(affinity.id)) {
        groupsById.set(affinity.id, {
          id: affinity.id,
          label: affinity.label,
          subtitle: affinity.subtitle,
          order: affinity.order,
          themes: [],
        });
      }
      groupsById.get(affinity.id).themes.push(theme);
    }

    return [...groupsById.values()]
      .map((group) => ({
        ...group,
        themes: group.themes.sort((a, b) => {
          if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
          return a.orderInSection - b.orderInSection;
        }),
      }))
      .sort((a, b) => a.order - b.order);
  }

  getDefaultThemeId() {
    return this.themes.length ? this.themes[0].id : null;
  }

  getExercisesByTheme(themeId) {
    return (this.exByTheme.get(themeId) || []).slice();
  }

  getExerciseById(exerciseId) {
    return this.exById.get(exerciseId) || null;
  }

  getNeighbors(exerciseId) {
    const ex = this.getExerciseById(exerciseId);
    if (!ex) return { prevId: null, nextId: null };
    const list = this.exercises;
    const idx = list.findIndex((item) => item.id === exerciseId);
    return {
      prevId: idx > 0 ? list[idx - 1].id : null,
      nextId: idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null,
    };
  }

  getLastExercise() {
    if (this.progress.lastExerciseId && this.exById.has(this.progress.lastExerciseId)) {
      const ex = this.getExerciseById(this.progress.lastExerciseId);
      if (ex) return ex;
    }
    const fallbackId = this.#findLatestCompletedFromHistory();
    return fallbackId ? this.getExerciseById(fallbackId) : null;
  }

  getResumeExercise() {
    const doneSet = new Set(this.progress.completedIds);
    if (!this.exercises.length) return null;

    const anchorId = this.progress.lastExerciseId || this.#findLatestCompletedFromHistory();
    const anchor = anchorId ? this.getExerciseById(anchorId) : null;
    if (anchor && !doneSet.has(anchor.id)) {
      return anchor;
    }

    const totalDone = doneSet.size;
    if (totalDone === 0) {
      return this.exercises[0];
    }

    // Priorité 1: continuer dans la même série à partir du dernier exercice fait.
    if (anchor) {
      const themeList = this.getExercisesByTheme(anchor.moduleId);
      const anchorIndex = themeList.findIndex((item) => item.id === anchor.id);
      if (anchorIndex >= 0) {
        for (let i = anchorIndex + 1; i < themeList.length; i += 1) {
          const candidate = themeList[i];
          if (!doneSet.has(candidate.id)) return candidate;
        }
      }
    }

    // Priorité 2: premier exercice non terminé dans l'ordre global.
    for (const exercise of this.exercises) {
      if (!doneSet.has(exercise.id)) return exercise;
    }

    // Tout est terminé: reprendre sur le dernier exercice connu.
    if (anchor) return anchor;
    return this.exercises[this.exercises.length - 1];
  }

  getLastCompletedDate(exerciseId) {
    if (!exerciseId) return null;
    for (let i = this.progress.history.length - 1; i >= 0; i -= 1) {
      const h = this.progress.history[i];
      if (h.exerciseId === exerciseId && h.delta > 0) return h.date;
    }
    return null;
  }

  getIsDone(exerciseId) {
    return this.progress.completedIds.includes(exerciseId);
  }

  getStepsForExercise(exercise) {
    if (!exercise) return [];
    if (exercise.instructions && exercise.instructions.length > 0) return exercise.instructions;

    const fallback = [];
    if (exercise.description) fallback.push(exercise.description);
    if (exercise.docxUrl) fallback.push("Téléchargez le fichier de travail.");
    fallback.push("Reproduisez le document en vous aidant de l'image de l'énoncé.");
    if (exercise.imageResultat) fallback.push("Comparez votre travail avec le résultat attendu.");
    return fallback;
  }

  getVisualsForExercise(exercise) {
    if (!exercise) return { enonceImages: [], resultImages: [], extraImages: [] };

    const scrapeEnonceImages = uniqueStrings(exercise.scrapeEnonceImages);
    const scrapeResultImages = uniqueStrings(exercise.scrapeResultImages);
    let fallbackEnonceImages = [];
    let fallbackResultImages = [];

    if (exercise.imageEnonce && exercise.imageResultat) {
      if (exercise.imageEnonce === exercise.imageResultat) {
        fallbackResultImages = [exercise.imageResultat];
      } else {
        fallbackEnonceImages = [exercise.imageEnonce];
        fallbackResultImages = [exercise.imageResultat];
      }
    } else if (exercise.imageResultat) {
      fallbackResultImages = [exercise.imageResultat];
    } else if (exercise.imageEnonce) {
      // Règle métier demandée: image unique => résultat attendu.
      fallbackResultImages = [exercise.imageEnonce];
    }

    const hasScrapeVisuals = scrapeEnonceImages.length > 0 || scrapeResultImages.length > 0;
    const enonceImages = hasScrapeVisuals ? (scrapeEnonceImages.length ? scrapeEnonceImages : fallbackEnonceImages) : fallbackEnonceImages;
    const resultImages = hasScrapeVisuals ? (scrapeResultImages.length ? scrapeResultImages : fallbackResultImages) : fallbackResultImages;

    const used = new Set([...enonceImages, ...resultImages]);
    const extraImages = uniqueStrings(exercise.extraImages).filter((url) => !used.has(url));
    return { enonceImages, resultImages, extraImages };
  }

  markExerciseDone(exerciseId, done) {
    if (!this.exById.has(exerciseId)) return;
    const set = new Set(this.progress.completedIds);
    const has = set.has(exerciseId);
    if (done && !has) {
      set.add(exerciseId);
      this.progress.history.push({ date: dayString(new Date()), exerciseId, delta: 1 });
    } else if (!done && has) {
      set.delete(exerciseId);
      this.progress.history.push({ date: dayString(new Date()), exerciseId, delta: -1 });
    } else {
      return;
    }
    this.progress.completedIds = [...set];
    this.progress.lastExerciseId = exerciseId;
    this.#saveProgress();
  }

  markExerciseOpened(exerciseId) {
    if (!this.exById.has(exerciseId)) return false;
    if (this.progress.lastExerciseId === exerciseId) return false;
    this.progress.lastExerciseId = exerciseId;
    this.#saveProgress();
    return true;
  }

  getSummary() {
    const total = this.exercises.length;
    const completed = this.progress.completedIds.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const streak = this.getCurrentStreak();
    const level = this.getLevelLabel(percent);
    return { total, completed, percent, streak, level };
  }

  getCurrentStreak() {
    const positiveDays = new Set(this.progress.history.filter((h) => h.delta > 0).map((h) => h.date));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = dayString(cursor);
      if (positiveDays.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  getLevelLabel(percent) {
    if (percent >= 90) return "Maîtrise";
    if (percent >= 65) return "Autonomie";
    if (percent >= 35) return "Pratique";
    if (percent >= 10) return "Lancement";
    return "Démarrage";
  }

  getThemeProgressRows() {
    const doneSet = new Set(this.progress.completedIds);
    return this.themes.map((theme) => {
      const list = this.getExercisesByTheme(theme.id);
      const done = list.filter((e) => doneSet.has(e.id)).length;
      return {
        id: theme.id,
        name: theme.name,
        done,
        total: list.length,
        percent: list.length ? Math.round((done / list.length) * 100) : 0,
      };
    });
  }

  getCurveSeries(days = 30) {
    const seriesDays = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      seriesDays.push(dayString(dt));
    }

    const deltaByDay = new Map();
    for (const h of this.progress.history) {
      deltaByDay.set(h.date, (deltaByDay.get(h.date) || 0) + h.delta);
    }

    const windowDelta = seriesDays.reduce((sum, day) => sum + (deltaByDay.get(day) || 0), 0);
    let running = this.progress.completedIds.length - windowDelta;
    if (running < 0) running = 0;

    return seriesDays.map((day) => {
      running += deltaByDay.get(day) || 0;
      if (running < 0) running = 0;
      return { day, value: running };
    });
  }

  exportProgressJson() {
    return JSON.stringify(this.progress, null, 2);
  }

  importProgressObject(obj) {
    const imported = {
      version: 2,
      updatedAt: new Date().toISOString(),
      completedIds: uniqueStrings(obj && obj.completedIds),
      lastExerciseId: obj && typeof obj.lastExerciseId === "string" ? obj.lastExerciseId : null,
      history: Array.isArray(obj && obj.history)
        ? obj.history
            .map((h) => ({
              date: normalizeDate(h && h.date),
              exerciseId: h && typeof h.exerciseId === "string" ? h.exerciseId : null,
              delta: Number.isFinite(h && h.delta) ? Math.trunc(h.delta) : 0,
            }))
            .filter((h) => h.date && h.exerciseId && h.delta !== 0)
        : [],
    };
    this.progress = imported;
    this.#sanitizeProgress();
  }

  resetProgress() {
    this.progress = this.#emptyProgress();
    this.#saveProgress();
  }
}

window.WordAtelierModel = WordAtelierModel;
