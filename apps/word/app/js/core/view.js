(() => {
const SVG_NS = "http://www.w3.org/2000/svg";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortDate(isoDay) {
  const parts = String(isoDay || "").split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}/${parts[1]}`;
}

// Repart directement sur la constante des couleurs sans la ligne fantôme
const THEME_COLORS = [
  { accent: "#2e6f76", soft: "#e8f3f5", track: "#d2e6ea" },
  { accent: "#8b6b4a", soft: "#f4eee6", track: "#e7d9c6" },
  { accent: "#3f7a52", soft: "#eaf4ed", track: "#d4e6db" },
  { accent: "#5f6f97", soft: "#eceff8", track: "#d7deee" },
  { accent: "#9a5f63", soft: "#f7ecec", track: "#ebd5d7" },
  { accent: "#5b7b45", soft: "#eef5e9", track: "#dce9d1" },
];

function hashText(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getThemeColors(themeKey) {
  const index = hashText(themeKey) % THEME_COLORS.length;
  return THEME_COLORS[index];
}

function getThemeStateLabel(percent) {
  if (percent >= 100) return "Terminé";
  if (percent > 0) return "En cours";
  return "À démarrer";
}

class AtelierView {
  constructor() {
    this.navButtons = Array.from(document.querySelectorAll(".nav-btn"));
    this.pages = {
      home: document.getElementById("page-home"),
      themes: document.getElementById("page-themes"),
      affinity: document.getElementById("page-affinity"),
      exercise: document.getElementById("page-exercise"),
      progress: document.getElementById("page-progress"),
      profile: document.getElementById("page-profile"),
    };

    this.homeLastExercise = document.getElementById("home-last-exercise");
    this.homeProgressText = document.getElementById("home-progress-text");
    this.homeProgressBar = document.getElementById("home-progress-bar");
    this.homeLevel = document.getElementById("home-level");
    this.homeStartBtn = document.getElementById("home-start-btn");
    this.homeQuickTheme = document.getElementById("home-quick-theme");
    this.homeQuickExercise = document.getElementById("home-quick-exercise");
    this.homeStartHelp = document.getElementById("home-start-help");

    this.themesAffinityList = document.getElementById("themes-affinity-list");
    this.affinityTitle = document.getElementById("affinity-title");
    this.affinitySubtitle = document.getElementById("affinity-subtitle");
    this.affinityThemeList = document.getElementById("affinity-theme-list");

    this.exerciseStatusPill = document.getElementById("exercise-status-pill");
    this.exerciseTitle = document.getElementById("exercise-title");
    this.exerciseThemeLine = document.getElementById("exercise-theme-line");
    this.exerciseDescription = document.getElementById("exercise-description");
    this.exercisePreambleWrap = document.getElementById("exercise-preamble-wrap");
    this.exerciseInstructionsWrap = document.getElementById("exercise-instructions-wrap");
    this.exerciseCriteriaWrap = document.getElementById("exercise-criteria-wrap");
    this.exerciseSteps = document.getElementById("exercise-steps");
    this.exerciseStepsPreamble = document.getElementById("exercise-steps-preamble");
    this.exerciseCriteria = document.getElementById("exercise-criteria");
    this.exerciseWorkFileBtn = document.getElementById("exercise-workfile-btn")
      || document.getElementById("exercise-docx-btn");
    this.exerciseDocxBtn = this.exerciseWorkFileBtn;
    this.exerciseDownloadBtn = document.getElementById("exercise-download-btn");
    this.exerciseFilesActions = this.exerciseWorkFileBtn ? this.exerciseWorkFileBtn.parentElement : null;
    this.exercisePickWorkFileBtn = document.getElementById("exercise-pick-workfile-btn");
    this.exerciseOpenWorkFileBtn = document.getElementById("exercise-open-workfile-btn");
    this.exerciseWorkFileStatus = document.getElementById("exercise-workfile-status");
    this.exerciseImagesGrid = document.querySelector("#page-exercise .images-grid");
    this.exerciseEnonceCaption = document.getElementById("exercise-enonce-caption");
    this.exerciseResultCaption = document.getElementById("exercise-result-caption");
    this.exerciseEnonceImages = document.getElementById("exercise-enonce-images");
    this.exerciseResultImages = document.getElementById("exercise-result-images");
    this.exerciseExtraWrap = document.getElementById("exercise-extra-wrap");
    this.exerciseExtraImages = document.getElementById("exercise-extra-images");
    this.exercisePrevBtn = document.getElementById("exercise-prev-btn");
    this.exerciseNextBtn = document.getElementById("exercise-next-btn");
    this.exerciseToggleDoneBtn = document.getElementById("exercise-toggle-done-btn");
    this.exerciseBreadcrumb = document.getElementById("exercise-breadcrumb");
    this.exerciseThemeProgress = document.getElementById("exercise-theme-progress");
    this.exerciseThemeProgressBar = document.getElementById("exercise-theme-progress-bar");
    this.exerciseSaveNudge = document.getElementById("exercise-save-nudge");

    this.progressCompleted = document.getElementById("progress-stat-completed");
    this.progressRate = document.getElementById("progress-stat-rate");
    this.progressStreak = document.getElementById("progress-stat-streak");
    this.progressLevel = document.getElementById("progress-stat-level");
    this.progressCurve = document.getElementById("progress-curve");
    this.progressUserPath = document.getElementById("progress-user-path");
    this.progressStatus = document.getElementById("progress-file-status");
    this.headerUserBadge = document.getElementById("header-user-badge");
    this.headerUserName = this.headerUserBadge ? this.headerUserBadge.querySelector(".header-user-name") : null;

    this.imageModal = document.getElementById("image-modal");
    this.imageModalImg = document.getElementById("image-modal-img");
    this.imageModalClose = document.getElementById("image-modal-close");
    this.imageModalPrev = document.getElementById("image-modal-prev");
    this.imageModalNext = document.getElementById("image-modal-next");
    this.imageModalCaption = document.getElementById("image-modal-caption");
    this.imageModalCounter = document.getElementById("image-modal-counter");
    this.imageModalStage = null;
    this.modalGalleryItems = [];
    this.modalGalleryIndex = 0;
    this.modalZoom = 1;
    this.modalBaseWidth = 0;
    this.isModalDragging = false;
    this.modalDragStartX = 0;
    this.modalDragStartY = 0;
    this.modalScrollStartLeft = 0;
    this.modalScrollStartTop = 0;
    this.#ensureModalStage();
    this.#bindModalEvents();
  }

  setActiveNav(pageName) {
    for (const btn of this.navButtons) {
      btn.classList.toggle("active", btn.getAttribute("data-nav") === pageName);
    }
  }

  showPage(pageName) {
    for (const [key, section] of Object.entries(this.pages)) {
      section.classList.toggle("active", key === pageName);
    }
    const navPage = pageName === "exercise" || pageName === "affinity" ? "themes" : pageName;
    this.setActiveNav(navPage);
  }

  renderHome(vm) {
    this.homeProgressText.textContent = `${vm.completed} / ${vm.total} exercices terminés (${vm.percent}%)`;
    this.homeProgressBar.style.width = `${vm.percent}%`;
    this.homeLevel.textContent = `Palier actuel: ${vm.level}`;
    if (this.homeStartBtn) this.homeStartBtn.textContent = vm.startLabel || "Commencer maintenant";
    if (this.homeQuickTheme) this.homeQuickTheme.textContent = vm.startTheme || "À définir";
    if (this.homeQuickExercise) this.homeQuickExercise.textContent = vm.startExercise || "Choisissez un exercice";
    if (this.homeStartHelp) this.homeStartHelp.textContent = vm.startHelp || "Lance automatiquement le prochain exercice conseillé.";

    if (!vm.lastExercise) {
      this.homeLastExercise.innerHTML = `
        <p class="last-title">Aucun exercice terminé.</p>
        <p class="last-meta">Lancez votre premier exercice depuis la page Thèmes.</p>
      `;
    } else {
      this.homeLastExercise.innerHTML = `
        <p class="last-title">Exercice ${vm.lastExercise.num} - ${escapeHtml(vm.lastExercise.title)}</p>
        <p class="last-meta">Thème: ${escapeHtml(vm.lastExercise.moduleName)}</p>
        <p class="last-meta">${escapeHtml(vm.lastDoneText)}</p>
      `;
    }

  }

  renderAffinityOverview(vm) {
    if (!vm.groups.length) {
      this.themesAffinityList.innerHTML = `<div class="empty">Aucune catégorie disponible.</div>`;
      return;
    }

    this.themesAffinityList.innerHTML = vm.groups
      .map((group) => {
        const colors = getThemeColors(group.id);
        return `
        <button class="affinity-card" type="button" data-action="open-affinity" data-affinity-id="${escapeHtml(group.id)}">
          <div class="affinity-card-visual" style="--affinity-accent:${colors.accent};--affinity-soft:${colors.soft};--affinity-progress:${group.percent || 0}%;">
            <span class="affinity-card-percent">${group.percent || 0}%</span>
          </div>
          <div class="affinity-card-content">
          <h3 class="affinity-card-title">${escapeHtml(group.label)}</h3>
          <p class="affinity-card-subtitle">${escapeHtml(group.subtitle)}</p>
          <p class="affinity-card-count">${group.completedExercises || 0}/${group.totalExercises} exercices</p>
          <p class="affinity-card-state">${getThemeStateLabel(group.percent || 0)}</p>
          <div class="affinity-mini-track" aria-hidden="true">
            <div class="affinity-mini-fill" style="width:${group.percent || 0}%"></div>
          </div>
          </div>
        </button>
      `;
      })
      .join("");
  }

  renderAffinityPage(vm) {
    this.affinityTitle.textContent = vm.affinity.label;
    this.affinitySubtitle.textContent = vm.affinity.subtitle;

    if (!vm.cards.length) {
      this.affinityThemeList.innerHTML = `<div class="empty">Aucun thème disponible.</div>`;
      return;
    }

    this.affinityThemeList.innerHTML = vm.cards
      .map(
        (card) => `
        <section class="theme-block ${card.open ? "open" : ""}">
          <button class="theme-block-header" data-action="toggle-theme" data-affinity-id="${escapeHtml(vm.affinity.id)}" data-theme-id="${escapeHtml(card.id)}" aria-expanded="${card.open ? "true" : "false"}">
            <span class="theme-block-title">${escapeHtml(card.name)}</span>
            <span class="theme-block-meta">${card.done}/${card.total} (${card.percent}%)</span>
            <span class="theme-block-arrow">${card.open ? "▾" : "▸"}</span>
          </button>
          <div class="theme-block-body">
            <div class="exercise-list">
              ${card.rows.length
            ? card.rows
              .map(
                (row) => `
                      <div
                        class="exercise-row clickable ${row.done ? "done" : ""}"
                        data-action="open-exercise"
                        data-id="${row.id}"
                        data-hover-label="${row.done ? "Refaire l'exercice" : "Lancer l'exercice"}"
                        role="button"
                        tabindex="0"
                        aria-label="Ouvrir l'exercice ${row.num} ${escapeHtml(row.title)}"
                      >
                        <div>
                          <p class="exercise-row-title">Exercice ${row.num}</p>
                          <p class="exercise-row-sub">${escapeHtml(row.title)}</p>
                        </div>
                        <div class="exercise-row-actions">
                          <button class="btn has-icon ${row.done ? "done" : ""}" data-icon="${row.done ? "\u2713" : "\u25CB"}" data-action="toggle-done" data-id="${row.id}">
                            ${row.done ? "Fait" : "\u00E0 faire"}
                          </button>
                        </div>
                      </div>
                    `,
              )
              .join("")
            : `<div class="empty">Aucun exercice dans ce thème.</div>`
          }
            </div>
          </div>
        </section>
      `,
      )
      .join("");
  }

  renderExercise(vm) {
    this.exerciseTitle.textContent = `Exercice ${vm.exercise.num} - ${vm.exercise.title}`;
    this.exerciseThemeLine.textContent = vm.exercise.moduleName;

    // Fil d'ariane
    if (this.exerciseBreadcrumb) {
      const aff = vm.affinityLabel
        ? `<span class="breadcrumb-link" data-action="open-affinity" data-affinity-id="${escapeHtml(vm.affinityId || "")}">${escapeHtml(vm.affinityLabel)}</span><span class="breadcrumb-sep">&#10095;</span>`
        : "";
      const theme = `<span class="breadcrumb-link" data-action="toggle-theme" data-affinity-id="${escapeHtml(vm.affinityId || "")}" data-theme-id="${escapeHtml(vm.exercise.moduleId)}">${escapeHtml(vm.exercise.moduleName)}</span><span class="breadcrumb-sep">&#10095;</span>`;
      this.exerciseBreadcrumb.innerHTML = `${aff}${theme}<span class="breadcrumb-current">Exercice ${vm.exercise.num}</span>`;
    }

    // Progression dans le thème
    if (this.exerciseThemeProgress && vm.themeTotal) {
      this.exerciseThemeProgress.textContent = `${vm.themeDone || 0} / ${vm.themeTotal} faits`;
    }
    if (this.exerciseThemeProgressBar && vm.themeTotal) {
      this.exerciseThemeProgressBar.style.width = `${Math.round(((vm.themeDone || 0) / vm.themeTotal) * 100)}%`;
    }

    this.exerciseStatusPill.textContent = vm.done ? "Fait ✓" : "À faire";
    this.exerciseStatusPill.classList.toggle("todo", !vm.done);
    this.exerciseToggleDoneBtn.setAttribute("data-id", vm.exercise.id);

    if (this.exerciseDescription) {
      this.exerciseDescription.textContent = vm.exercise.description || "";
      this.exerciseDescription.style.display = vm.exercise.description ? "" : "none";
    }

    const preamble = (vm.exercise && vm.exercise.preamble) ? vm.exercise.preamble : "";
    if (this.exercisePreambleWrap) {
      this.exercisePreambleWrap.style.display = preamble ? "" : "none";
    }
    if (this.exerciseStepsPreamble) {
      this.exerciseStepsPreamble.textContent = preamble;
      this.exerciseStepsPreamble.style.display = preamble ? "" : "none";
    }

    const paragraphOnly = this.#isParagraphOnlyExercise(vm.exercise, vm.steps || []);
    const formatStep = (step) => this.#formatStepForExercise(vm.exercise, step);
    this.exerciseSteps.classList.remove("steps-copy-mode", "steps-paragraph-mode", "steps-has-copy");
    if (paragraphOnly) {
      const lines = (vm.steps || [])
        .map((line) => String(line || "").trim())
        .filter(Boolean);
      const text = lines.length
        ? lines.map((line) => formatStep(line)).join("<br>")
        : "Reproduisez le document en suivant l'énoncé.";
      this.exerciseSteps.classList.add("steps-paragraph-mode");
      this.exerciseSteps.innerHTML = `<p class="steps-paragraph-text">${text}</p>`;
    } else {
      const normalizedSteps = (vm.steps || []).map((step) => String(step || "").trim()).filter(Boolean);
      const markerPattern = /^texte\s+à\s+copier\/coller\s*:?\s*$/i;
      const copyIntroPattern = /(texte\s+à\s+copier\/coller|copier-coller\s+(?:le|la|ce)?\s*(?:texte|liste)|copier-coller\s+ce\s+texte)/i;
      const numberedStepPattern = /^\d+\./;
      let hasCopyBlock = false;
      const items = [];

      for (let i = 0; i < normalizedSteps.length; i += 1) {
        const line = normalizedSteps[i];
        const lineParts = line.split("\n").map((part) => part.trim()).filter(Boolean);

        if (copyIntroPattern.test(lineParts[0] || "") && lineParts.length > 1) {
          hasCopyBlock = true;
          items.push(`
            <li class="copy-step">
              <p class="steps-instruction">${this.#formatStepPlain(lineParts[0])}</p>
              <pre class="steps-copy-block">${escapeHtml(lineParts.slice(1).join("\n"))}</pre>
            </li>
          `);
          continue;
        }

        if (markerPattern.test(line)) {
          const copyLines = [];
          let j = i + 1;
          while (j < normalizedSteps.length) {
            const next = normalizedSteps[j];
            if (numberedStepPattern.test(next)) break;
            copyLines.push(next);
            j += 1;
          }

          if (copyLines.length) {
            hasCopyBlock = true;
            items.push(`
              <li class="copy-step">
                <p class="steps-instruction">${this.#formatStepPlain(line)}</p>
                <pre class="steps-copy-block">${escapeHtml(copyLines.join("\n"))}</pre>
              </li>
            `);
            i = j - 1;
            continue;
          }
        }

        if (copyIntroPattern.test(line)) {
          const copyLines = [];
          let j = i + 1;
          while (j < normalizedSteps.length) {
            const next = normalizedSteps[j];
            if (numberedStepPattern.test(next)) break;
            copyLines.push(next);
            j += 1;
          }

          if (copyLines.length >= 2) {
            hasCopyBlock = true;
            items.push(`
              <li class="copy-step">
                <p class="steps-instruction">${this.#formatStepPlain(line)}</p>
                <pre class="steps-copy-block">${escapeHtml(copyLines.join("\n"))}</pre>
              </li>
            `);
            i = j - 1;
            continue;
          }
        }

        items.push(`<li>${formatStep(line)}</li>`);
      }

      if (hasCopyBlock) this.exerciseSteps.classList.add("steps-has-copy");
      this.exerciseSteps.innerHTML = items.length
        ? items.join("")
        : "<li>Reproduisez le document en suivant l'énoncé.</li>";
    }

    if (this.exerciseInstructionsWrap) {
      this.exerciseInstructionsWrap.style.display = (vm.steps || []).length ? "" : "none";
    }

    if (this.exerciseCriteria) {
      const criteria = Array.isArray(vm.exercise.criteria) ? vm.exercise.criteria.filter(Boolean) : [];
      this.exerciseCriteria.innerHTML = criteria.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      if (this.exerciseCriteriaWrap) {
        this.exerciseCriteriaWrap.style.display = criteria.length ? "" : "none";
      }
    }

    const workFileUrl = vm.exercise.workFileUrl || vm.exercise.docxUrl || "";
    if (this.exerciseWorkFileBtn && workFileUrl) {
      this.exerciseWorkFileBtn.href = workFileUrl;
      this.exerciseWorkFileBtn.download = this.#getExerciseDownloadFileName(vm.exercise, workFileUrl);
      this.exerciseWorkFileBtn.style.display = "";
    } else if (this.exerciseWorkFileBtn) {
      this.exerciseWorkFileBtn.removeAttribute("href");
      this.exerciseWorkFileBtn.removeAttribute("download");
      this.exerciseWorkFileBtn.style.display = "none";
    }
    if (vm.exercise.downloadUrl) {
      this.exerciseDownloadBtn.href = vm.exercise.downloadUrl;
      this.exerciseDownloadBtn.textContent = vm.exercise.downloadLabel || "Telecharger le 2e fichier";
      this.exerciseDownloadBtn.style.display = "";
    } else {
      this.exerciseDownloadBtn.removeAttribute("href");
      this.exerciseDownloadBtn.style.display = "none";
    }
    this.#renderExtraDownloadButtons(vm.exercise.extraDownloadUrls || []);

    const hasFiles = Boolean(
      workFileUrl
      || vm.exercise.downloadUrl
      || ((vm.exercise.extraDownloadUrls || []).length > 0),
    );
    const filesCard = document.getElementById("exercise-files-card");
    if (filesCard) filesCard.style.display = hasFiles ? "" : "none";

    this.exerciseEnonceCaption.textContent = vm.exercise.imageEnonceCaption || "Énoncé";
    this.exerciseResultCaption.textContent = vm.exercise.imageResultatCaption || "Résultat attendu";

    this.#renderImageGroup(
      this.exerciseEnonceImages,
      vm.visuals.enonceImages,
      "Image énoncé",
      "Pas d'image d'énoncé sur la source.",
    );
    this.#renderImageGroup(
      this.exerciseResultImages,
      vm.visuals.resultImages,
      "Image résultat attendu",
      "Pas d'image de résultat sur la source.",
    );
    this.#syncImagesGridLayout();
    this.#renderExtraImages(vm.visuals.extraImages || []);

    this.exercisePrevBtn.disabled = !vm.prevId;
    this.exerciseNextBtn.disabled = !vm.nextId;
    this.exercisePrevBtn.setAttribute("data-target-id", vm.prevId || "");
    this.exerciseNextBtn.setAttribute("data-target-id", vm.nextId || "");
    this.setExerciseWorkFileState(vm.workFile || null);
  }

  #formatStep(step) {
    const text = String(step || "").trim();
    const formatMultiline = (value) => escapeHtml(value).replace(/\n/g, "<br>");
    const colonIndex = text.indexOf(":");
    if (colonIndex <= 0) return formatMultiline(text);

    const label = text.slice(0, colonIndex).trim();
    if (!label) return formatMultiline(text);

    // Ne mettre en gras que les vrais "labels" courts (ex: "Police", "Titre",
    // "Élément 1"), pas les phrases longues générées automatiquement
    // (ex: "Construisez la structure ... à partir de cet objectif:").
    // Sans ce garde-fou, une phrase complète en gras suivie du contenu
    // donne l'impression visuelle de deux éléments distincts.
    const wordCount = label.split(/\s+/).filter(Boolean).length;
    const looksLikeLabel = label.length <= 30 && wordCount <= 4;

    const rest = text.slice(colonIndex + 1).trimStart();
    if (!looksLikeLabel) {
      // Phrase longue suivie de son contenu : on saute une ligne après les
      // deux-points pour bien séparer visuellement l'objectif du contenu,
      // sans pour autant le mettre en gras (ce n'est pas un vrai "label").
      if (!rest) return formatMultiline(text);
      return `${formatMultiline(`${label} :`)}<br>${formatMultiline(rest)}`;
    }
    if (!rest) return `<strong>${escapeHtml(label)}:</strong>`;
    return `<strong>${escapeHtml(label)}:</strong> ${formatMultiline(rest)}`;
  }

  #formatStepForExercise(exercise, step) {
    const raw = String(step || "").trim();
    if (exercise && exercise.id === "ex-010") {
      const normalized = raw
        .replace(/[💾"]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (normalized === "le raccourci clavier pour enregistrer rapidement est ctrl+s") {
        return "<strong>💾 Le raccourci clavier pour enregistrer rapidement est ctrl+s 💾</strong>";
      }
    }
    return this.#formatStep(step);
  }

  #formatStepPlain(step) {
    const text = String(step || "").trim();
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  #isParagraphOnlyExercise(exercise, steps) {
    if (!exercise) return false;
    // Si le JSON dit explicitement "active le mode paragraphe", on renvoie true
    if (exercise.paragraphMode === true) {
      if (!Array.isArray(steps)) return false;
      return steps.map((line) => String(line || "").trim()).filter(Boolean).length >= 1;
    }
    // Par défaut, pour tous les autres exercices, cela renverra false
    // et l'application affichera les puces (<li>)
    return false;
  }

  #renderImageGroup(containerEl, images, altPrefix, emptyMessage) {
    const figure = containerEl.closest(".image-card");
    const existingEmpty = figure.querySelector(".image-empty");
    if (existingEmpty) existingEmpty.remove();

    const unique = [];
    const seen = new Set();
    for (const item of images || []) {
      const src = typeof item === "string" ? item : item && item.src;
      if (!src || seen.has(src)) continue;
      seen.add(src);
      unique.push({
        src,
        caption: typeof item === "object" && item ? String(item.caption || "") : "",
      });
    }
    if (!unique.length) {
      containerEl.innerHTML = "";
      figure.classList.remove("empty");
      figure.style.display = "none";
      return;
    }

    figure.style.display = "";
    figure.classList.remove("empty");
    containerEl.innerHTML = unique
      .map(
        (image, idx) => `
        <button class="image-thumb" type="button" data-zoom-src="${escapeHtml(image.src)}" title="Cliquer pour agrandir">
          <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.caption || `${altPrefix} ${idx + 1}`)}">
          <span class="image-thumb-hint">🔍 Cliquer pour agrandir</span>
        </button>
      `,
      )
      .join("");

    const buttons = Array.from(containerEl.querySelectorAll("button[data-zoom-src]"));
    const galleryItems = unique.map((image, idx) => ({
      src: image.src,
      alt: image.caption || `${altPrefix} ${idx + 1}`,
      caption: image.caption || "",
    }));
    for (const [index, btn] of buttons.entries()) {
      btn.addEventListener("click", () => {
        this.openImageModal(galleryItems[index].src, galleryItems[index].alt, galleryItems, index);
      });
      btn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.openImageModal(galleryItems[index].src, galleryItems[index].alt, galleryItems, index);
        }
      });
    }
  }

  #renderExtraImages(images) {
    const unique = [...new Set((images || []).filter(Boolean))];
    if (!unique.length) {
      this.exerciseExtraWrap.style.display = "none";
      this.exerciseExtraImages.innerHTML = "";
      return;
    }
    this.exerciseExtraWrap.style.display = "";
    this.exerciseExtraImages.innerHTML = unique
      .map(
        (src, idx) => `
        <button class="extra-image" type="button" data-zoom-src="${escapeHtml(src)}" title="Cliquer pour agrandir">
          <img src="${escapeHtml(src)}" alt="Image illustrative ${idx + 1}">
          <span class="image-thumb-hint">🔍 Cliquer pour agrandir</span>
        </button>
      `,
      )
      .join("");
    const buttons = Array.from(this.exerciseExtraImages.querySelectorAll("button[data-zoom-src]"));
    const galleryItems = unique.map((src, idx) => ({
      src,
      alt: `Image illustrative ${idx + 1}`,
      caption: "",
    }));
    for (const [index, btn] of buttons.entries()) {
      btn.addEventListener("click", () => {
        this.openImageModal(galleryItems[index].src, galleryItems[index].alt, galleryItems, index);
      });
      btn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.openImageModal(galleryItems[index].src, galleryItems[index].alt, galleryItems, index);
        }
      });
    }
  }

  #renderExtraDownloadButtons(downloads) {
    if (!this.exerciseFilesActions) return;

    const oldButtons = this.exerciseFilesActions.querySelectorAll(".exercise-extra-download");
    for (const node of oldButtons) node.remove();

    const items = Array.isArray(downloads) ? downloads.filter((item) => item && item.url) : [];
    for (const item of items) {
      const link = document.createElement("a");
      link.className = "btn has-icon exercise-extra-download";
      link.dataset.icon = "⬇";
      link.target = "_blank";
      link.rel = "noopener";
      link.href = item.url;
      link.textContent = item.label || "Telecharger un fichier";
      this.exerciseFilesActions.insertBefore(link, this.exercisePickWorkFileBtn || null);
    }
  }

  #syncImagesGridLayout() {
    if (!this.exerciseImagesGrid) return;
    const cards = Array.from(this.exerciseImagesGrid.querySelectorAll(".image-card"));
    const visibleCards = cards.filter((card) => card.style.display !== "none");

    this.exerciseImagesGrid.classList.toggle("single-image-block", visibleCards.length === 1);
    for (const card of cards) {
      card.classList.remove("single-image-card");
    }
    if (visibleCards.length === 1) {
      visibleCards[0].classList.add("single-image-card");
    }
  }

  renderProgress(vm) {
    this.progressCompleted.textContent = `${vm.completed} / ${vm.total}`;
    this.progressRate.textContent = `${vm.percent}%`;
    this.progressStreak.textContent = `${vm.streak} ${vm.streak > 1 ? "jours" : "jour"}`;
    this.progressLevel.textContent = vm.level;
    this.renderCurve(vm.curveSeries);
  }

  renderCurve(series) {
    const svg = this.progressCurve;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (!series || series.length === 0) return;

    const width = 860;
    const height = 220;
    const left = 46;
    const right = 16;
    const top = 14;
    const bottom = 28;
    const chartW = width - left - right;
    const chartH = height - top - bottom;

    const maxValue = Math.max(8, ...series.map((p) => p.value));
    for (let i = 0; i <= 4; i += 1) {
      const y = top + (i / 4) * chartH;
      this.#addLine(svg, left, y, left + chartW, y, "#e7dfd4", 1);
      const val = Math.round(maxValue - (i / 4) * maxValue);
      this.#addText(svg, 8, y + 4, String(val), "#738292", 11);
    }

    const points = series.map((entry, index) => {
      const x = left + (index / (series.length - 1)) * chartW;
      const y = top + chartH - (entry.value / maxValue) * chartH;
      return { x, y, value: entry.value, day: entry.day };
    });

    const poly = document.createElementNS(SVG_NS, "polyline");
    poly.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "#2e6f76");
    poly.setAttribute("stroke-width", "3");
    poly.setAttribute("stroke-linecap", "round");
    poly.setAttribute("stroke-linejoin", "round");
    svg.appendChild(poly);

    const first = points[0];
    const last = points[points.length - 1];
    this.#addCircle(svg, first.x, first.y, 4, "#bc6f34");
    this.#addCircle(svg, last.x, last.y, 5, "#2e6f76");
    this.#addText(svg, last.x - 5, Math.max(12, last.y - 10), String(last.value), "#2e6f76", 11, "700");
    this.#addText(svg, left, height - 8, shortDate(first.day), "#6c7b8a", 11);
    this.#addText(svg, width - 46, height - 8, shortDate(last.day), "#6c7b8a", 11);
  }

  #addLine(svg, x1, y1, x2, y2, color, width) {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", String(width));
    svg.appendChild(line);
  }

  #addCircle(svg, x, y, r, fill) {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", String(r));
    dot.setAttribute("fill", fill);
    svg.appendChild(dot);
  }

  #addText(svg, x, y, text, fill, size, weight) {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y));
    label.setAttribute("fill", fill);
    label.setAttribute("font-size", String(size));
    if (weight) label.setAttribute("font-weight", weight);
    label.textContent = text;
    svg.appendChild(label);
  }

  setProgressUserPath(message) {
    if (!this.progressUserPath) return;
    this.progressUserPath.textContent = message || "";
  }

  setProgressStatus(message) {
    this.progressStatus.textContent = message || "";
  }

  setHeaderUser(firstName, initials) {
    if (!this.headerUserName) return;
    const safeFirstName = String(firstName || "").trim();
    const safeInitials = String(initials || "").trim();
    if (safeFirstName && safeInitials) {
      this.headerUserName.textContent = `${safeFirstName} (${safeInitials})`;
      return;
    }
    if (safeFirstName) {
      this.headerUserName.textContent = safeFirstName;
      return;
    }
    if (safeInitials) {
      this.headerUserName.textContent = safeInitials;
      return;
    }
    this.headerUserName.textContent = "Non connecté";
  }

  updateStatusTag(isDone) {
    if (!this.exerciseStatusPill) return;
    this.exerciseStatusPill.textContent = isDone ? "Fait ✓" : "À faire";
    this.exerciseStatusPill.classList.toggle("todo", !isDone);
    const id = this.exerciseToggleDoneBtn ? this.exerciseToggleDoneBtn.getAttribute("data-id") : null;
    if (id) this.exerciseToggleDoneBtn.setAttribute("data-id", id);
  }

  updateSaveNudge(isDone) {
    if (!this.exerciseSaveNudge) return;
    this.exerciseSaveNudge.hidden = isDone;
  }

  setExerciseWorkFileState(workFileVm) {
    if (!this.exercisePickWorkFileBtn || !this.exerciseOpenWorkFileBtn || !this.exerciseWorkFileStatus) return;

    const vm = workFileVm && typeof workFileVm === "object" ? workFileVm : {};
    const pickerSupported = vm.pickerSupported !== false;
    const fileName = String(vm.fileName || "").trim();
    const openVisible = Boolean(vm.openVisible && fileName);

    this.exercisePickWorkFileBtn.style.display = "none";
    this.exercisePickWorkFileBtn.textContent = "S\u00e9lectionner mon fichier";

    this.exerciseOpenWorkFileBtn.style.display = pickerSupported && openVisible ? "" : "none";
    this.exerciseOpenWorkFileBtn.disabled = !pickerSupported || !openVisible || Boolean(vm.openDisabled);
    this.exerciseOpenWorkFileBtn.textContent = openVisible
      ? `S\u00e9lectionner mon fichier: ${fileName}`
      : "S\u00e9lectionner mon fichier";

    if (!pickerSupported) {
      this.exerciseWorkFileStatus.textContent = "S\u00e9lection du fichier indisponible sur ce navigateur.";
      return;
    }

    if (typeof vm.statusText === "string" && vm.statusText.trim()) {
      this.exerciseWorkFileStatus.textContent = vm.statusText.trim();
      return;
    }

    this.exerciseWorkFileStatus.textContent = openVisible
      ? `Fichier attendu: ${fileName}`
      : "";
  }

  #bindModalEvents() {
    if (!this.imageModal || !this.imageModalImg || !this.imageModalClose || !this.imageModalStage) return;
    this.imageModalClose.addEventListener("click", () => this.closeImageModal());
    if (this.imageModalPrev) this.imageModalPrev.addEventListener("click", () => this.showPreviousModalImage());
    if (this.imageModalNext) this.imageModalNext.addEventListener("click", () => this.showNextModalImage());
    this.imageModalImg.addEventListener("load", () => {
      this.#setModalZoom(this.modalZoom);
    });
    this.imageModalImg.addEventListener("dblclick", (event) => {
      event.preventDefault();
      const nextZoom = this.modalZoom < 8 ? this.modalZoom * 2 : 1;
      this.#setModalZoom(nextZoom);
    });
    this.imageModalImg.addEventListener("mousedown", (event) => {
      if (this.modalZoom <= 1) return;
      event.preventDefault();
      this.isModalDragging = true;
      this.modalDragStartX = event.clientX;
      this.modalDragStartY = event.clientY;
      this.modalScrollStartLeft = this.imageModalStage.scrollLeft;
      this.modalScrollStartTop = this.imageModalStage.scrollTop;
      this.imageModalImg.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (event) => {
      if (!this.isModalDragging || !this.imageModalStage) return;
      const dx = event.clientX - this.modalDragStartX;
      const dy = event.clientY - this.modalDragStartY;
      this.imageModalStage.scrollLeft = this.modalScrollStartLeft - dx;
      this.imageModalStage.scrollTop = this.modalScrollStartTop - dy;
    });
    document.addEventListener("mouseup", () => {
      if (!this.isModalDragging) return;
      this.isModalDragging = false;
      this.imageModalImg.style.cursor = this.modalZoom > 1 ? "grab" : "zoom-in";
    });
    this.imageModalStage.addEventListener(
      "wheel",
      (event) => {
        if (event.deltaY < 0) {
          event.preventDefault();
          this.#setModalZoom(Math.min(8, this.modalZoom + 1));
          return;
        }
        event.preventDefault();
        this.#setModalZoom(Math.max(1, this.modalZoom - 1));
      },
      { passive: false },
    );
    this.imageModal.addEventListener("click", (event) => {
      if (event.target === this.imageModal) this.closeImageModal();
    });
    document.addEventListener("keydown", (event) => {
      if (this.imageModal.hidden) return;
      if (event.key === "Escape") this.closeImageModal();
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.showPreviousModalImage();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.showNextModalImage();
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        this.#setModalZoom(Math.min(8, this.modalZoom + 1));
      }
      if (event.key === "-") {
        event.preventDefault();
        this.#setModalZoom(Math.max(1, this.modalZoom - 1));
      }
    });
  }

  openImageModal(src, altText, galleryItems = null, galleryIndex = 0) {
    if (!src || !this.imageModal || !this.imageModalImg) return;
    const normalizedItems = Array.isArray(galleryItems) && galleryItems.length
      ? galleryItems.filter((item) => item && item.src)
      : [{ src, alt: altText || "Aperçu" }];
    const maxIndex = normalizedItems.length - 1;
    this.modalGalleryItems = normalizedItems;
    this.modalGalleryIndex = Math.max(0, Math.min(maxIndex, Number(galleryIndex) || 0));
    this.#renderModalImage();
    this.imageModal.hidden = false;
    this.imageModal.setAttribute("aria-hidden", "false");
  }

  showPreviousModalImage() {
    if (this.modalGalleryIndex <= 0) return;
    this.modalGalleryIndex -= 1;
    this.#renderModalImage();
  }

  showNextModalImage() {
    if (this.modalGalleryIndex >= this.modalGalleryItems.length - 1) return;
    this.modalGalleryIndex += 1;
    this.#renderModalImage();
  }

  closeImageModal() {
    if (!this.imageModal || !this.imageModalImg) return;
    this.imageModal.hidden = true;
    this.imageModal.setAttribute("aria-hidden", "true");
    this.imageModalImg.removeAttribute("src");
    this.imageModalImg.alt = "";
    if (this.imageModalCaption) {
      this.imageModalCaption.textContent = "";
      this.imageModalCaption.hidden = true;
    }
    this.modalGalleryItems = [];
    this.modalGalleryIndex = 0;
    this.#updateModalNavigation();
    this.isModalDragging = false;
    this.#setModalZoom(1);
  }

  #renderModalImage() {
    const item = this.modalGalleryItems[this.modalGalleryIndex];
    if (!item || !this.imageModalImg) return;
    this.imageModalImg.src = item.src;
    this.imageModalImg.alt = item.alt || "Aperçu";
    if (this.imageModalCaption) {
      const caption = String(item.caption || "").trim();
      this.imageModalCaption.textContent = caption;
      this.imageModalCaption.hidden = !caption;
    }
    this.#setModalZoom(1);
    this.#updateModalNavigation();
  }

  #updateModalNavigation() {
    const total = this.modalGalleryItems.length;
    const hasMultiple = total > 1;
    if (this.imageModalPrev) {
      this.imageModalPrev.hidden = !hasMultiple;
      this.imageModalPrev.disabled = !hasMultiple || this.modalGalleryIndex <= 0;
    }
    if (this.imageModalNext) {
      this.imageModalNext.hidden = !hasMultiple;
      this.imageModalNext.disabled = !hasMultiple || this.modalGalleryIndex >= total - 1;
    }
    if (this.imageModalCounter) {
      this.imageModalCounter.hidden = !hasMultiple;
      this.imageModalCounter.textContent = hasMultiple ? `${this.modalGalleryIndex + 1} / ${total}` : "";
    }
  }

  #setModalZoom(value) {
    this.modalZoom = Math.max(1, Math.min(8, Number(value) || 1));
    if (!this.imageModalImg || !this.imageModalStage) return;

    if (this.modalZoom === 1) {
      this.modalBaseWidth = 0;
      this.imageModalImg.style.maxWidth = "min(1200px, 94vw)";
      this.imageModalImg.style.maxHeight = "90vh";
      this.imageModalImg.style.width = "";
      this.imageModalImg.style.height = "";
      this.imageModalImg.style.cursor = "zoom-in";
      this.imageModalStage.scrollLeft = 0;
      this.imageModalStage.scrollTop = 0;
      return;
    }

    if (!this.modalBaseWidth) {
      this.modalBaseWidth = this.imageModalImg.getBoundingClientRect().width || this.imageModalImg.naturalWidth || 0;
    }
    const width = Math.max(1, Math.round(this.modalBaseWidth * this.modalZoom));
    this.imageModalImg.style.maxWidth = "none";
    this.imageModalImg.style.maxHeight = "none";
    this.imageModalImg.style.width = `${width}px`;
    this.imageModalImg.style.height = "auto";
    this.imageModalImg.style.cursor = "grab";
  }

  #ensureModalStage() {
    if (!this.imageModal || !this.imageModalImg) return;
    const parent = this.imageModalImg.parentElement;
    if (parent && parent.classList.contains("image-modal-stage")) {
      this.imageModalStage = parent;
      return;
    }
    const stage = document.createElement("div");
    stage.className = "image-modal-stage";
    this.imageModal.insertBefore(stage, this.imageModalImg);
    stage.appendChild(this.imageModalImg);
    this.imageModalStage = stage;
  }

  #getExerciseDownloadFileName(exercise, fileUrl) {
    const exerciseNumber = Number(exercise && exercise.num);
    const exerciseId = Number.isFinite(exerciseNumber) && exerciseNumber > 0
      ? `ex-${String(exerciseNumber).padStart(3, "0")}`
      : String(exercise && exercise.id ? exercise.id : "")
        .trim()
        .toLowerCase()
        .replace(/^ex-(\d{1,2})$/, (_match, value) => `ex-${String(value).padStart(3, "0")}`)
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "exercice";
    let extension = ".docx";

    try {
      const parsed = new URL(String(fileUrl || ""), window.location.href);
      const lastSegment = parsed.pathname.split("/").filter(Boolean).pop() || "";
      const match = lastSegment.match(/\.[a-z0-9]{2,8}$/i);
      if (match) extension = match[0].toLowerCase();
    } catch {
      // conserver .docx
    }

    return `${exerciseId}${extension}`;
  }
}

window.AtelierView = AtelierView;
})();
