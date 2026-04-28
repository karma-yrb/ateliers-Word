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

class WordAtelierView {
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
    this.exerciseSteps = document.getElementById("exercise-steps");
    this.exerciseDocxBtn = document.getElementById("exercise-docx-btn");
    this.exerciseDownloadBtn = document.getElementById("exercise-download-btn");
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
    this.imageModalStage = null;
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
              ${
                card.rows.length
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
                          <button class="btn has-icon ${row.done ? "done" : ""}" data-icon="${row.done ? "✓" : "○"}" data-action="toggle-done" data-id="${row.id}">
                            ${row.done ? "Fait" : "À faire"}
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
    this.exerciseThemeLine.textContent = `Thème: ${vm.exercise.moduleName}`;

    this.exerciseStatusPill.textContent = vm.done ? "Fait" : "À faire";
    this.exerciseStatusPill.classList.toggle("todo", !vm.done);
    this.exerciseToggleDoneBtn.textContent = vm.done ? "À faire" : "Fait";
    this.exerciseToggleDoneBtn.classList.toggle("done", vm.done);
    this.exerciseToggleDoneBtn.setAttribute("data-icon", vm.done ? "○" : "✓");

    const copyBlock = this.#extractCopyBlock(vm.steps || []);
    const paragraphOnly = this.#isParagraphOnlyExercise(vm.exercise, vm.steps || []);
    this.exerciseSteps.classList.remove("steps-copy-mode", "steps-paragraph-mode");
    if (copyBlock) {
      this.exerciseSteps.classList.add("steps-copy-mode");
      this.exerciseSteps.innerHTML = `
        <p class="steps-instruction">${escapeHtml(copyBlock.instruction)}</p>
        <pre class="steps-copy-block">${escapeHtml(copyBlock.text)}</pre>
      `;
    } else if (paragraphOnly) {
      const lines = (vm.steps || [])
        .map((line) => String(line || "").trim())
        .filter(Boolean);
      const text = lines.length
        ? lines.map((line) => this.#formatStep(line)).join("<br>")
        : "Reproduisez le document en suivant l'énoncé.";
      this.exerciseSteps.classList.add("steps-paragraph-mode");
      this.exerciseSteps.innerHTML = `<p class="steps-paragraph-text">${text}</p>`;
    } else {
      const steps = vm.steps.length
        ? vm.steps.map((step) => `<li>${this.#formatStep(step)}</li>`).join("")
        : "<li>Reproduisez le document en suivant l'énoncé.</li>";
      this.exerciseSteps.innerHTML = steps;
    }

    if (vm.exercise.docxUrl) {
      this.exerciseDocxBtn.href = vm.exercise.docxUrl;
      this.exerciseDocxBtn.style.display = "";
    } else {
      this.exerciseDocxBtn.removeAttribute("href");
      this.exerciseDocxBtn.style.display = "none";
    }
    if (vm.exercise.downloadUrl) {
      this.exerciseDownloadBtn.href = vm.exercise.downloadUrl;
      this.exerciseDownloadBtn.style.display = "";
    } else {
      this.exerciseDownloadBtn.removeAttribute("href");
      this.exerciseDownloadBtn.style.display = "none";
    }
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
    this.exerciseToggleDoneBtn.setAttribute("data-id", vm.exercise.id);
  }

  #formatStep(step) {
    const text = String(step || "").replace(/^\s*\d+\s*[-.)]\s*/, "");
    const colonIndex = text.indexOf(":");
    if (colonIndex <= 0) return escapeHtml(text);

    const label = text.slice(0, colonIndex).trim();
    if (!label) return escapeHtml(text);

    const rest = text.slice(colonIndex + 1).trimStart();
    if (!rest) return `<strong>${escapeHtml(label)}:</strong>`;
    return `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(rest)}`;
  }

  #extractCopyBlock(steps) {
    if (!Array.isArray(steps) || steps.length < 3) return null;
    const normalized = steps.map((line) => String(line || "").trim()).filter(Boolean);
    if (normalized.length < 3) return null;

    const markerIndex = normalized.findIndex((line) => /^texte\s+à\s+copier\/coller\s*:?\s*$/i.test(line));
    if (markerIndex <= 0 || markerIndex >= normalized.length - 1) return null;

    const instruction = normalized[0];
    const copyLines = normalized.slice(markerIndex + 1);
    if (!copyLines.length) return null;

    return {
      instruction,
      text: copyLines.join("\n"),
    };
  }

  #isParagraphOnlyExercise(exercise, steps) {
    if (!exercise) return false;
    const paragraphOnlyIds = new Set(["ex-037", "ex-038"]);
    if (!paragraphOnlyIds.has(exercise.id)) return false;
    if (!Array.isArray(steps)) return false;
    return steps.map((line) => String(line || "").trim()).filter(Boolean).length >= 1;
  }

  #renderImageGroup(containerEl, images, altPrefix, emptyMessage) {
    const figure = containerEl.closest(".image-card");
    const existingEmpty = figure.querySelector(".image-empty");
    if (existingEmpty) existingEmpty.remove();

    const unique = [...new Set((images || []).filter(Boolean))];
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
        (src, idx) => `
        <button class="image-thumb" type="button" data-zoom-src="${escapeHtml(src)}">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(altPrefix)} ${idx + 1}">
        </button>
      `,
      )
      .join("");

    const buttons = containerEl.querySelectorAll("button[data-zoom-src]");
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        const src = btn.getAttribute("data-zoom-src");
        this.openImageModal(src, altPrefix);
      });
      btn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const src = btn.getAttribute("data-zoom-src");
          this.openImageModal(src, altPrefix);
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
        <button class="extra-image" type="button" data-zoom-src="${escapeHtml(src)}" title="Image ${idx + 1}">
          <img src="${escapeHtml(src)}" alt="Image illustrative ${idx + 1}">
        </button>
      `,
      )
      .join("");
    const buttons = this.exerciseExtraImages.querySelectorAll("button[data-zoom-src]");
    for (const btn of buttons) {
      btn.addEventListener("click", () => {
        const src = btn.getAttribute("data-zoom-src");
        this.openImageModal(src, "Image illustrative");
      });
      btn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const src = btn.getAttribute("data-zoom-src");
          this.openImageModal(src, "Image illustrative");
        }
      });
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

  #bindModalEvents() {
    if (!this.imageModal || !this.imageModalImg || !this.imageModalClose || !this.imageModalStage) return;
    this.imageModalClose.addEventListener("click", () => this.closeImageModal());
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

  openImageModal(src, altText) {
    if (!src || !this.imageModal || !this.imageModalImg) return;
    this.imageModalImg.src = src;
    this.imageModalImg.alt = altText || "Aperçu";
    this.#setModalZoom(1);
    this.imageModal.hidden = false;
    this.imageModal.setAttribute("aria-hidden", "false");
  }

  closeImageModal() {
    if (!this.imageModal || !this.imageModalImg) return;
    this.imageModal.hidden = true;
    this.imageModal.setAttribute("aria-hidden", "true");
    this.imageModalImg.removeAttribute("src");
    this.imageModalImg.alt = "";
    this.isModalDragging = false;
    this.#setModalZoom(1);
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
}

window.WordAtelierView = WordAtelierView;
