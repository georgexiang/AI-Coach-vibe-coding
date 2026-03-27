#!/usr/bin/env node
// Generate wiki pages from .planning/ GSD artifacts.
// No external dependencies -- uses only Node.js built-in modules.
//
// Generated pages:
//   wiki/Planning-Overview.md      <- .planning/PROJECT.md
//   wiki/Planning-Roadmap.md       <- .planning/ROADMAP.md
//   wiki/Planning-Requirements.md  <- .planning/REQUIREMENTS.md
//   wiki/Planning-Phase-XX.md      <- .planning/phases/XX-*
//   wiki/Planning-Research.md      <- .planning/research/SUMMARY.md
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const REPO_ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const PLANNING_DIR = join(REPO_ROOT, ".planning");
const WIKI_DIR = join(REPO_ROOT, "wiki");

const TODAY = new Date().toISOString().split("T")[0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip YAML frontmatter and return body only. */
function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? content.slice(match[0].length).trim() : content.trim();
}

/** Read file if it exists, otherwise return null. */
function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}

/**
 * Convert a phase directory slug to a human-readable name.
 * "01-foundation-auth-and-design-system" → "Foundation Auth And Design System"
 */
function formatPhaseName(slug) {
  return slug
    .replace(/^\d+(?:\.\d+)?-/, "") // strip number prefix
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Derive the wiki page name for a phase number.
 * "01"   → "Planning-Phase-01"
 * "01.1" → "Planning-Phase-01-1"
 */
function phaseWikiName(num) {
  return `Planning-Phase-${num.replace(".", "-")}`;
}

/** Auto-generated header banner for every page. */
function banner(_sourceDesc, sourcePath) {
  return (
    `> Auto-generated from [\`${sourcePath}\`](../blob/main/${sourcePath})  \n` +
    `> Last synced: ${TODAY}\n\n`
  );
}

// ---------------------------------------------------------------------------
// Page generators
// ---------------------------------------------------------------------------

function generateOverview() {
  const src = readIfExists(join(PLANNING_DIR, "PROJECT.md"));
  if (!src) return;
  const body = stripFrontmatter(src);
  const page =
    `# Project Overview\n\n` +
    banner("PROJECT.md", ".planning/PROJECT.md") +
    body +
    "\n";
  writeFileSync(join(WIKI_DIR, "Planning-Overview.md"), page);
  console.log("  Planning-Overview.md");
}

function generateRoadmap() {
  const src = readIfExists(join(PLANNING_DIR, "ROADMAP.md"));
  if (!src) return;

  // Inject links from phase headers to their wiki detail pages
  let body = src.replace(
    /^(### Phase (\d+(?:\.\d+)?): )(.+)/gm,
    (_match, prefix, num, title) => {
      return `${prefix}[${title}](${phaseWikiName(num)})`;
    }
  );

  const page =
    `# Project Roadmap\n\n` +
    banner("ROADMAP.md", ".planning/ROADMAP.md") +
    body +
    "\n";
  writeFileSync(join(WIKI_DIR, "Planning-Roadmap.md"), page);
  console.log("  Planning-Roadmap.md");
}

function generateRequirements() {
  const src = readIfExists(join(PLANNING_DIR, "REQUIREMENTS.md"));
  if (!src) return;
  const body = stripFrontmatter(src);
  const page =
    `# Requirements Traceability\n\n` +
    banner("REQUIREMENTS.md", ".planning/REQUIREMENTS.md") +
    body +
    "\n";
  writeFileSync(join(WIKI_DIR, "Planning-Requirements.md"), page);
  console.log("  Planning-Requirements.md");
}

function generateResearch() {
  const summaryPath = join(PLANNING_DIR, "research", "SUMMARY.md");
  const src = readIfExists(summaryPath);
  if (!src) return;
  const body = stripFrontmatter(src);

  // Link to sibling research files
  const researchDir = join(PLANNING_DIR, "research");
  const siblings = readdirSync(researchDir)
    .filter((f) => f.endsWith(".md") && f !== "SUMMARY.md")
    .sort();
  const links =
    siblings.length > 0
      ? `**Detailed research:**\n${siblings
          .map(
            (f) =>
              `- [${f.replace(".md", "")}](../blob/main/.planning/research/${f})`
          )
          .join("\n")}\n\n`
      : "";

  const page =
    `# Research Summary\n\n` +
    banner("research/", ".planning/research") +
    links +
    body +
    "\n";
  writeFileSync(join(WIKI_DIR, "Planning-Research.md"), page);
  console.log("  Planning-Research.md");
}

function generatePhasePages() {
  const phasesDir = join(PLANNING_DIR, "phases");
  if (!existsSync(phasesDir)) return;

  const dirs = readdirSync(phasesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    const slug = dir.name;
    const numMatch = slug.match(/^(\d+(?:\.\d+)?)/);
    if (!numMatch) continue;
    const phaseNum = numMatch[1];
    const phasePath = join(phasesDir, slug);
    const files = readdirSync(phasePath);
    const name = formatPhaseName(slug);

    let page = `# Phase ${phaseNum}: ${name}\n\n`;
    page += banner(
      `phases/${slug}/`,
      `.planning/phases/${slug}`
    );

    // --- Context ---
    const contextFile = files.find((f) => f.endsWith("-CONTEXT.md"));
    if (contextFile) {
      const body = stripFrontmatter(
        readFileSync(join(phasePath, contextFile), "utf-8")
      );
      page += `## Context & Decisions\n\n${body}\n\n`;
    }

    // --- Plans table ---
    const planFiles = files.filter((f) => /-PLAN\.md$/.test(f)).sort();
    const summaryFiles = new Set(
      files.filter((f) => /-SUMMARY\.md$/.test(f))
    );
    if (planFiles.length > 0) {
      page += `## Plans (${planFiles.length})\n\n`;
      page += `| # | Plan File | Status |\n`;
      page += `|---|-----------|--------|\n`;

      for (const pf of planFiles) {
        const summaryName = pf.replace("-PLAN.md", "-SUMMARY.md");
        const status = summaryFiles.has(summaryName) ? "Complete" : "Pending";
        const planNum = pf.replace("-PLAN.md", "");
        page += `| ${planNum} | ${pf} | ${status} |\n`;
      }
      page += "\n";
    }

    // --- Research (collapsible) ---
    const researchFile = files.find((f) => f.endsWith("-RESEARCH.md"));
    if (researchFile) {
      const body = stripFrontmatter(
        readFileSync(join(phasePath, researchFile), "utf-8")
      );
      page += `## Research\n\n`;
      page += `<details><summary>Click to expand research notes</summary>\n\n`;
      page += `${body}\n\n`;
      page += `</details>\n\n`;
    }

    // --- UI Spec (collapsible) ---
    const uiSpecFile = files.find((f) => f.endsWith("-UI-SPEC.md"));
    if (uiSpecFile) {
      const body = stripFrontmatter(
        readFileSync(join(phasePath, uiSpecFile), "utf-8")
      );
      page += `## UI Specification\n\n`;
      page += `<details><summary>Click to expand UI spec</summary>\n\n`;
      page += `${body}\n\n`;
      page += `</details>\n\n`;
    }

    // --- Verification (collapsible) ---
    const verificationFile = files.find((f) =>
      f.endsWith("-VERIFICATION.md")
    );
    if (verificationFile) {
      const body = stripFrontmatter(
        readFileSync(join(phasePath, verificationFile), "utf-8")
      );
      page += `## Verification\n\n`;
      page += `<details><summary>Click to expand verification report</summary>\n\n`;
      page += `${body}\n\n`;
      page += `</details>\n\n`;
    }

    const wikiFileName = `${phaseWikiName(phaseNum)}.md`;
    writeFileSync(join(WIKI_DIR, wikiFileName), page);
    console.log(`  ${wikiFileName}`);
  }
}

// ---------------------------------------------------------------------------
// Sidebar update
// ---------------------------------------------------------------------------

function updateSidebar() {
  const sidebarPath = join(WIKI_DIR, "_Sidebar.md");
  if (!existsSync(sidebarPath)) return;
  let sidebar = readFileSync(sidebarPath, "utf-8");

  const planningSection = generatePlanningSidebarSection();

  if (sidebar.includes("<!-- PLANNING_START -->")) {
    sidebar = sidebar.replace(
      /<!-- PLANNING_START -->[\s\S]*?<!-- PLANNING_END -->/,
      planningSection
    );
  } else {
    // Insert before the "---" separator (Quick Links section)
    const sepIdx = sidebar.indexOf("---");
    if (sepIdx > -1) {
      sidebar =
        sidebar.slice(0, sepIdx) +
        planningSection +
        "\n\n" +
        sidebar.slice(sepIdx);
    } else {
      sidebar += "\n\n" + planningSection;
    }
  }

  writeFileSync(sidebarPath, sidebar);
  console.log("  _Sidebar.md (updated)");
}

function generatePlanningSidebarSection() {
  const phasesDir = join(PLANNING_DIR, "phases");
  let phaseLinks = "";

  if (existsSync(phasesDir)) {
    const dirs = readdirSync(phasesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    phaseLinks = dirs
      .map((d) => {
        const num = d.name.match(/^(\d+(?:\.\d+)?)/)?.[1] || "";
        const name = formatPhaseName(d.name);
        return `  - [Phase ${num}: ${name}](${phaseWikiName(num)})`;
      })
      .join("\n");
  }

  return `<!-- PLANNING_START -->
## Planning

- [Project Overview](Planning-Overview)
- [Roadmap](Planning-Roadmap)
- [Requirements](Planning-Requirements)
- [Research](Planning-Research)
- **Phases**
${phaseLinks}
<!-- PLANNING_END -->`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("=== Generating wiki pages from .planning/ ===");

if (!existsSync(PLANNING_DIR)) {
  console.log("No .planning/ directory found, skipping");
  process.exit(0);
}

generateOverview();
generateRoadmap();
generateRequirements();
generateResearch();
generatePhasePages();
updateSidebar();

console.log("=== Wiki generation complete ===");
