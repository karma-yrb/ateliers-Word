import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const INPUT_PATH = path.join(ROOT, "data", "exercises.json");
const OUTPUT_PATH = path.join(ROOT, "data", "exercises.structured.json");
const LOG_JSON_PATH = path.join(ROOT, "logs", "scrape-report.json");
const LOG_TXT_PATH = path.join(ROOT, "logs", "scrape-report.txt");
const INDEX_URL = "https://www.clic-formation.net/tableur.html";

const BASE_URL = "https://www.clic-formation.net";
const CONCURRENCY = 6;
const RETRIES = 2;
const TIMEOUT_MS = 20000;

const DECORATIVE_IMAGE_PATTERNS = [
  "/images/site/",
  "/images/stories/",
  "/images/icone/",
  "/templates/",
  "/media/",
  "/modules/",
];

const EXERCISE_IMAGE_HINT = /\/images\/(02-word|03-word|03-excel|excel|word|tableau|publipostage|document|exercices|niveau)/i;

const LEVEL_MAP = {
  1: "Debutant",
  2: "Intermediaire",
  3: "Avance",
  4: "Expert",
};

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function normalizeSpace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToText(value) {
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(noTags);
  return decoded
    .split("\n")
    .map((line) => normalizeSpace(line))
    .filter(Boolean)
    .join("\n");
}

function normalizeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${BASE_URL}${trimmed}`;
  return `${BASE_URL}/${trimmed.replace(/^\/+/, "")}`;
}

function isDecorativeImage(src) {
  if (!src) return true;
  const lower = src.toLowerCase();
  if (!/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(lower)) return true;
  return DECORATIVE_IMAGE_PATTERNS.some((token) => lower.includes(token));
}

function extractDivContent(html, startIndex) {
  const firstTagClose = html.indexOf(">", startIndex);
  if (firstTagClose === -1) return null;
  let depth = 1;
  let cursor = firstTagClose + 1;
  const divTagRegex = /<\/?div\b[^>]*>/gi;
  divTagRegex.lastIndex = cursor;

  while (true) {
    const match = divTagRegex.exec(html);
    if (!match) break;
    const token = match[0].toLowerCase();
    if (token.startsWith("</div")) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(cursor, match.index);
      }
    } else {
      depth += 1;
    }
  }
  return null;
}

function extractElementContent(html, startIndex, tagName) {
  const firstTagClose = html.indexOf(">", startIndex);
  if (firstTagClose === -1) return null;
  let depth = 1;
  let cursor = firstTagClose + 1;
  const tagRegex = new RegExp(`</?${tagName}\\b[^>]*>`, "gi");
  tagRegex.lastIndex = cursor;

  while (true) {
    const match = tagRegex.exec(html);
    if (!match) break;
    const token = match[0].toLowerCase();
    if (token.startsWith(`</${tagName}`)) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(cursor, match.index);
      }
    } else {
      depth += 1;
    }
  }
  return null;
}

function extractArticleBody(html) {
  const marker = 'itemprop="articleBody"';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;
  const divStart = html.lastIndexOf("<div", markerIdx);
  if (divStart === -1) return null;
  return extractDivContent(html, divStart);
}

function splitByHeadings(articleHtml) {
  const headingRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  const sections = [];
  let currentIndex = 0;
  let currentTitle = "Enonce";
  let match;

  while ((match = headingRegex.exec(articleHtml)) !== null) {
    const title = normalizeSpace(htmlToText(match[1])) || "Section";
    if (match.index > currentIndex) {
      sections.push({
        title: currentTitle,
        html: articleHtml.slice(currentIndex, match.index),
      });
    }
    currentTitle = title;
    currentIndex = headingRegex.lastIndex;
  }

  if (currentIndex < articleHtml.length) {
    sections.push({
      title: currentTitle,
      html: articleHtml.slice(currentIndex),
    });
  }

  if (sections.length === 0) {
    sections.push({ title: "Enonce", html: articleHtml });
  }

  return sections;
}

function extractImagesFromHtml(html) {
  const imgRegex = /<img\b[^>]*>/gi;
  const images = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/\bsrc\s*=\s*"([^"]+)"/i);
    if (!srcMatch) continue;
    const src = normalizeUrl(srcMatch[1]);
    if (!src) continue;
    const altMatch = tag.match(/\balt\s*=\s*"([^"]*)"/i);
    const widthMatch = tag.match(/\bwidth\s*=\s*"([^"]+)"/i);
    const heightMatch = tag.match(/\bheight\s*=\s*"([^"]+)"/i);
    const width = widthMatch ? Number.parseInt(widthMatch[1], 10) : null;
    const height = heightMatch ? Number.parseInt(heightMatch[1], 10) : null;
    images.push({
      src,
      alt: altMatch ? decodeHtmlEntities(altMatch[1]).trim() : "",
      width: Number.isFinite(width) ? width : null,
      height: Number.isFinite(height) ? height : null,
    });
  }

  return images;
}

function scoreImage(img) {
  let score = 0;
  if (img.width && img.width >= 300) score += 4;
  if (img.height && img.height >= 180) score += 3;
  if (EXERCISE_IMAGE_HINT.test(img.src)) score += 5;
  if (/result|résultat|final/i.test(img.alt) || /result/i.test(img.src)) score += 4;
  if (isDecorativeImage(img.src)) score -= 8;
  return score;
}

function pickExerciseImages(section) {
  const raw = extractImagesFromHtml(section.html);
  const filtered = raw
    .filter((img) => !isDecorativeImage(img.src) || EXERCISE_IMAGE_HINT.test(img.src))
    .map((img) => ({ ...img, score: scoreImage(img) }))
    .filter((img) => img.score > -3)
    .sort((a, b) => b.score - a.score);
  return filtered;
}

function cleanInstructionLine(value) {
  let text = value;
  text = text.replace(/^[\-\u2022•\d\)\.\s]+/, "");
  text = normalizeSpace(text);
  return text;
}

function extractInstructions(enonceHtml) {
  const listItems = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(enonceHtml)) !== null) {
    const item = cleanInstructionLine(htmlToText(liMatch[1]));
    if (item && item.length > 2) listItems.push(item);
  }
  if (listItems.length > 0) return [...new Set(listItems)];

  const paragraphSteps = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(enonceHtml)) !== null) {
    let block = pMatch[1];
    block = block.replace(/<img[^>]*fleche[^>]*>/gi, "\n- ");
    block = block.replace(/<br\s*\/?>/gi, "\n");
    const text = htmlToText(block);
    for (const line of text.split("\n")) {
      const cleaned = cleanInstructionLine(line);
      if (!cleaned) continue;
      if (/^t[ée]l[ée]charg/i.test(cleaned)) continue;
      if (/^clics\s*:/i.test(cleaned)) continue;
      paragraphSteps.push(cleaned);
    }
  }

  return [...new Set(paragraphSteps)];
}

function findDocxUrl(html) {
  const matches = [...html.matchAll(/https?:\/\/[^"' >]+\.(?:xlsx|xls|xlsm|zip|docx)/gi)].map((m) => m[0]);
  if (!matches.length) return null;
  return normalizeUrl(matches[0]);
}

function findPrevNext(html) {
  const prevMatch = html.match(/<a[^>]+rel="prev"[^>]+href="([^"]+)"/i);
  const nextMatch = html.match(/<a[^>]+rel="next"[^>]+href="([^"]+)"/i);
  return {
    prevUrl: prevMatch ? normalizeUrl(prevMatch[1]) : null,
    nextUrl: nextMatch ? normalizeUrl(nextMatch[1]) : null,
  };
}

function parseLevelFromHtml(html) {
  const levelMatch = html.match(/Niveau de difficult[ée][^:]*:\s*([1-4])/i);
  if (!levelMatch) return null;
  return Number(levelMatch[1]);
}

function normalizeTitle(title) {
  return normalizeSpace(title.replace(/\s*-\s*Clic-Formation.*$/i, ""));
}

function extractTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return normalizeTitle(htmlToText(match[1]));
}

function slugify(value) {
  return normalizeSpace(String(value || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function attrValue(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function cleanCatalogTitle(value) {
  return normalizeSpace(htmlToText(value));
}

function sectionIdFromTitle(title) {
  const normalized = slugify(title);
  if (normalized.includes("base")) return "bases";
  if (normalized.includes("avance")) return "avance";
  if (normalized.includes("fonction")) return "fonctions";
  if (normalized.includes("asca")) return "asca";
  if (normalized.includes("exercices-complets")) return "complets";
  return normalized;
}

function isExerciseCatalogLink(label, href, title) {
  const text = normalizeSpace(`${label} ${title}`).toLowerCase();
  const url = String(href || "").toLowerCase();
  if (!href || href.startsWith("javascript:")) return false;
  if (/support|quizz|quiz|evaluation|g[ée]n[ée]ralit[ée]s|blog|les outils/.test(text)) return false;
  if (/\/support|\/evaluation|quizz|quiz/.test(url)) return false;
  return /exercice|cas |r[ée]vision|calculs|planning|fiche|formulaire|facturation|course|salon|gantt|garage|intervention|calendrier|reservation/i.test(`${label} ${title} ${href}`);
}

function parseExerciseNum(label, fallback) {
  const match = String(label || "").match(/exercice\s*(\d+)/i);
  if (match) return Number.parseInt(match[1], 10);
  return fallback;
}

function parseLevelFromCatalogLink(tag) {
  const img = tag.match(/<img\b[^>]*>/i)?.[0] || "";
  const src = attrValue(img, "src");
  const srcMatch = src.match(/\/([1-4])(?:-[^/?#]*)?\.(?:png|jpg|webp|gif)/i);
  return srcMatch ? Number.parseInt(srcMatch[1], 10) : 1;
}

async function buildCatalogFromIndex() {
  const html = await fetchWithRetry(INDEX_URL);
  const articleHtml = extractArticleBody(html) || html;
  const h3Regex = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  const headings = [];
  let headingMatch;
  while ((headingMatch = h3Regex.exec(articleHtml)) !== null) {
    const title = cleanCatalogTitle(headingMatch[1]);
    if (/^(Excel|Fonctions|Pr[ée]parez|Exercices complets)/i.test(title)) {
      headings.push({ title, index: headingMatch.index, end: h3Regex.lastIndex });
    }
  }

  const modules = [];
  const exercises = [];
  let globalIndex = 0;

  for (let sectionIndex = 0; sectionIndex < headings.length; sectionIndex += 1) {
    const section = headings[sectionIndex];
    const next = headings[sectionIndex + 1];
    const sectionHtml = articleHtml.slice(section.end, next ? next.index : articleHtml.length);
    const sectionId = sectionIdFromTitle(section.title);
    const level1Regex = /<li\b[^>]*data-level="1"[^>]*>/gi;
    let moduleMatch;
    let orderInSection = 0;

    while ((moduleMatch = level1Regex.exec(sectionHtml)) !== null) {
      const liHtml = extractElementContent(sectionHtml, moduleMatch.index, "li");
      if (!liHtml) continue;
      const titleMatch = liHtml.match(/<a\b[^>]*href="javascript:void\(0\);"[^>]*>([\s\S]*?)<\/a>/i)
        || liHtml.match(/<a\b[^>]*class="[^"]*separator[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
        || liHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
      const moduleName = titleMatch ? cleanCatalogTitle(titleMatch[1]) : `Module ${modules.length + 1}`;
      if (!moduleName || /evaluation/i.test(moduleName)) continue;

      orderInSection += 1;
      const moduleId = `${sectionId}-${slugify(moduleName)}`;
      const module = {
        id: moduleId,
        name: moduleName,
        cleanName: moduleName,
        section: sectionId,
        sectionOrder: sectionIndex + 1,
        orderInSection,
      };

      const linkRegex = /<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
      let linkMatch;
      let numInModule = 0;
      const moduleExercises = [];
      while ((linkMatch = linkRegex.exec(liHtml)) !== null) {
        const tag = linkMatch[0];
        const href = decodeHtmlEntities(linkMatch[1]);
        const labelMatch = tag.match(/<span class="image-title">([\s\S]*?)<span/i);
        const label = labelMatch ? cleanCatalogTitle(labelMatch[1]) : cleanCatalogTitle(tag);
        const title = attrValue(tag, "title");
        if (!isExerciseCatalogLink(label, href, title)) continue;
        numInModule += 1;
        globalIndex += 1;
        const cleanTitle = normalizeSpace(title.replace(/^Exercice\s*\d+\s*[:-]?\s*/i, "")) || label || `Exercice ${numInModule}`;
        moduleExercises.push({
          id: `excel-ex-${String(globalIndex).padStart(3, "0")}`,
          globalIndex,
          moduleId,
          moduleName,
          moduleNameClean: moduleName,
          num: parseExerciseNum(label, numInModule),
          title: cleanTitle,
          level: parseLevelFromCatalogLink(tag),
          pageUrl: normalizeUrl(href),
          docxUrl: null,
          downloadUrl: null,
          downloadLabel: "",
          imageEnonce: null,
          imageResultat: null,
          imageEnonceCaption: "",
          imageResultatCaption: "",
          description: cleanTitle,
          preamble: "",
          instructions: [],
        });
      }

      if (moduleExercises.length > 0) {
        modules.push(module);
        exercises.push(...moduleExercises);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: INDEX_URL,
    modules,
    exercises,
  };
}

function buildSectionMap(sections) {
  const result = {
    enonceSection: sections[0] || { title: "Enonce", html: "" },
    resultatSection: null,
  };

  const nonEmpty = (section) => normalizeSpace(htmlToText(section.html || "")).length > 0;

  for (const section of sections) {
    const key = normalizeSpace(section.title).toLowerCase();
    if (key.includes("resultat") || key.includes("résultat") || key.includes("resultat attendu")) {
      result.resultatSection = section;
      continue;
    }
    if (key.includes("enonce") || key.includes("énoncé")) {
      result.enonceSection = section;
    }
  }

  if (!nonEmpty(result.enonceSection)) {
    const fallback = sections.find((section) => {
      const key = normalizeSpace(section.title).toLowerCase();
      const isResult = key.includes("resultat") || key.includes("résultat");
      return !isResult && nonEmpty(section);
    });
    if (fallback) result.enonceSection = fallback;
  }

  return result;
}

async function fetchWithRetry(url, retries = RETRIES) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: abort.signal,
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; word-atelier-scraper/1.0)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 300));
    }
  }
  throw lastError;
}

async function scrapeOne(exercise) {
  if (!exercise.pageUrl) {
    return {
      id: exercise.id,
      ok: false,
      reason: "missing_page_url",
    };
  }

  const pageUrl = normalizeUrl(exercise.pageUrl);
  const html = await fetchWithRetry(pageUrl);
  const articleHtml = extractArticleBody(html);
  if (!articleHtml) {
    return {
      id: exercise.id,
      url: pageUrl,
      ok: false,
      reason: "article_body_not_found",
    };
  }

  const sections = splitByHeadings(articleHtml);
  const { enonceSection, resultatSection } = buildSectionMap(sections);
  const enonceImages = pickExerciseImages(enonceSection);
  const resultImages = resultatSection ? pickExerciseImages(resultatSection) : [];
  const allImages = pickExerciseImages({ html: articleHtml });

  const explicitResultImage =
    resultImages[0] ||
    allImages.find((img) => /result|résultat|final/i.test(`${img.alt} ${img.src}`)) ||
    null;
  let explicitEnonceImage =
    enonceImages.find((img) => !explicitResultImage || img.src !== explicitResultImage.src) ||
    allImages.find((img) => !explicitResultImage || img.src !== explicitResultImage.src) ||
    null;
  if (!explicitEnonceImage && explicitResultImage) {
    explicitEnonceImage = explicitResultImage;
  }

  const instructions = extractInstructions(enonceSection.html);
  const description = (() => {
    const text = htmlToText(enonceSection.html);
    const firstLine = text.split("\n").find((line) => line.length > 4);
    return firstLine || null;
  })();

  const level = parseLevelFromHtml(html);
  const docxUrl = findDocxUrl(articleHtml) || findDocxUrl(html);
  const { prevUrl, nextUrl } = findPrevNext(html);

  return {
    id: exercise.id,
    url: pageUrl,
    ok: true,
    titleFromPage: extractTitle(html),
    level,
    levelLabel: level ? LEVEL_MAP[level] : null,
    docxUrl,
    instructions,
    description,
    imageEnonce: explicitEnonceImage ? explicitEnonceImage.src : null,
    imageResultat: explicitResultImage ? explicitResultImage.src : null,
    enonceImages: enonceImages.map((img) => img.src),
    resultImages: resultImages.map((img) => img.src),
    extraImages: enonceImages
      .map((img) => img.src)
      .filter((src) => src !== (explicitEnonceImage && explicitEnonceImage.src)),
    prevUrl,
    nextUrl,
  };
}

async function runPool(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) break;
      try {
        results[current] = await worker(items[current], current);
      } catch (error) {
        results[current] = {
          id: items[current].id,
          url: items[current].pageUrl,
          ok: false,
          reason: "fetch_failed",
          error: String(error?.message || error),
        };
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runner());
  await Promise.all(workers);
  return results;
}

function dedupeSteps(steps) {
  return [...new Set((steps || []).map((s) => cleanInstructionLine(String(s))).filter(Boolean))];
}

async function main() {
  const start = Date.now();
  const dataset = await buildCatalogFromIndex();
  await fs.writeFile(INPUT_PATH, JSON.stringify(dataset, null, 2), "utf8");

  const exercises = dataset.exercises || [];
  const withUrls = exercises.filter((ex) => ex.pageUrl);

  console.log(`Scraping ${withUrls.length} pages...`);

  let done = 0;
  const scrapeResults = await runPool(
    withUrls,
    async (exercise) => {
      const result = await scrapeOne(exercise);
      done += 1;
      if (done % 20 === 0 || done === withUrls.length) {
        console.log(`Progress: ${done}/${withUrls.length}`);
      }
      return result;
    },
    CONCURRENCY,
  );

  const scrapeMap = new Map(scrapeResults.map((item) => [item.id, item]));

  const enrichedExercises = exercises.map((ex) => {
    const scraped = scrapeMap.get(ex.id);
    if (!scraped || !scraped.ok) {
      return {
        ...ex,
        instructions: dedupeSteps(ex.consignes || []),
        scrape: scraped || { ok: false, reason: "not_scraped" },
      };
    }

    const mergedSteps = dedupeSteps(
      (scraped.instructions && scraped.instructions.length ? scraped.instructions : []).concat(ex.consignes || []),
    );

    return {
      ...ex,
      title: ex.title || scraped.titleFromPage || ex.title,
      level: ex.level || scraped.level || 0,
      levelLabel: ex.levelLabel || scraped.levelLabel || null,
      docxUrl: scraped.docxUrl || ex.docxUrl || null,
      imageEnonce: scraped.imageEnonce || ex.imageEnonce || null,
      imageResultat: scraped.imageResultat || ex.imageResultat || null,
      description: ex.description || scraped.description || null,
      instructions: mergedSteps,
      scrape: {
        ok: true,
        url: scraped.url,
        prevUrl: scraped.prevUrl,
        nextUrl: scraped.nextUrl,
        extraImages: scraped.extraImages || [],
        enonceImages: scraped.enonceImages || [],
        resultImages: scraped.resultImages || [],
      },
    };
  });

  const okCount = scrapeResults.filter((item) => item.ok).length;
  const failCount = scrapeResults.length - okCount;
  const withSteps = enrichedExercises.filter((ex) => ex.instructions && ex.instructions.length > 0).length;
  const withDocx = enrichedExercises.filter((ex) => ex.docxUrl).length;
  const withEnonce = enrichedExercises.filter((ex) => ex.imageEnonce).length;
  const withResult = enrichedExercises.filter((ex) => ex.imageResultat).length;

  const output = {
    ...dataset,
    generatedAt: new Date().toISOString(),
    source: `${dataset.source || "unknown"} + live scrape`,
    scrapeSummary: {
      totalExercises: exercises.length,
      attempted: scrapeResults.length,
      ok: okCount,
      failed: failCount,
      withInstructions: withSteps,
      withDocx,
      withImageEnonce: withEnonce,
      withImageResultat: withResult,
      durationSeconds: Math.round((Date.now() - start) / 1000),
    },
    exercises: enrichedExercises,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  await fs.writeFile(LOG_JSON_PATH, JSON.stringify({ scrapeResults, summary: output.scrapeSummary }, null, 2), "utf8");
  await fs.writeFile(
    LOG_TXT_PATH,
    [
      `Scrape summary`,
      `- total: ${output.scrapeSummary.totalExercises}`,
      `- attempted: ${output.scrapeSummary.attempted}`,
      `- ok: ${output.scrapeSummary.ok}`,
      `- failed: ${output.scrapeSummary.failed}`,
      `- with instructions: ${output.scrapeSummary.withInstructions}`,
      `- with docx: ${output.scrapeSummary.withDocx}`,
      `- with enonce image: ${output.scrapeSummary.withImageEnonce}`,
      `- with result image: ${output.scrapeSummary.withImageResultat}`,
      `- duration (s): ${output.scrapeSummary.durationSeconds}`,
      ``,
      `Failed items:`,
      ...scrapeResults
        .filter((item) => !item.ok)
        .map((item) => `- ${item.id} | ${item.url || ""} | ${item.reason || "unknown"} | ${item.error || ""}`),
    ].join("\n"),
    "utf8",
  );

  console.log("Done.");
  console.log(output.scrapeSummary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
