---
status: awaiting_human_verify
trigger: "SKILL.md content in Skill Resources tab shows YAML frontmatter as a single line of plain text instead of preserving the multi-line YAML format with --- delimiters"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - ReactMarkdown strips YAML frontmatter (--- delimiters) because it treats them as metadata, not displayable content
test: Both meta-skills.tsx (line 519) and skill-editor.tsx (line 602) pass SKILL.md content through ReactMarkdown which parses and hides frontmatter
expecting: Fix by rendering SKILL.md as raw preformatted text instead of markdown
next_action: Awaiting human verification that SKILL.md displays correctly in browser

## Symptoms

expected: SKILL.md should display with proper YAML frontmatter format — `---` on top and bottom, each field on its own line, proper indentation for nested metadata
actual: YAML frontmatter fields are collapsed into a single line of text, `---` delimiters are missing, rendered as prose instead of structured YAML
errors: No error messages — it's a display/format issue
reproduction: Go to Meta Skills > Skill Creator > Skill Resources tab > click SKILL.md in file tree
started: Unknown

## Eliminated

- hypothesis: Backend flattens/strips YAML frontmatter during composition
  evidence: meta_skill_service.py line 98 does skill_file.read_text().strip() which preserves --- delimiters. SKILL.md on disk has correct multi-line YAML frontmatter. _load_skill_directory preserves content verbatim.
  timestamp: 2026-04-13T00:01:00Z

## Evidence

- timestamp: 2026-04-13T00:01:00Z
  checked: backend/app/services/meta_skill_templates/skill-creator/SKILL.md
  found: File on disk has correct YAML frontmatter with --- delimiters, multi-line format, nested metadata
  implication: Backend source is correct

- timestamp: 2026-04-13T00:02:00Z
  checked: backend/app/services/meta_skill_service.py _load_skill_directory()
  found: Line 98 reads file verbatim with read_text().strip(), preserving frontmatter. Line 109 puts skill_content as first part of composed output.
  implication: Backend composition preserves frontmatter correctly

- timestamp: 2026-04-13T00:03:00Z
  checked: frontend/src/pages/admin/meta-skills.tsx lines 516-524
  found: SKILL.md preview uses <ReactMarkdown rehypePlugins={[rehypeRaw]}>{editTemplate}</ReactMarkdown> — react-markdown treats --- frontmatter as YAML metadata and STRIPS it from rendered output
  implication: ROOT CAUSE - react-markdown hides frontmatter by design

- timestamp: 2026-04-13T00:03:30Z
  checked: frontend/src/pages/admin/skill-editor.tsx lines 598-607
  found: Same pattern — SKILL.md preview uses <ReactMarkdown rehypePlugins={[rehypeRaw]}>{skill.content}</ReactMarkdown>
  implication: Same bug exists in skill-editor.tsx too

## Resolution

root_cause: Both meta-skills.tsx and skill-editor.tsx render SKILL.md content through ReactMarkdown, which by design parses YAML frontmatter (content between --- delimiters) as metadata and strips it from the visible output. The frontmatter is neither displayed as YAML nor as markdown — it simply disappears.
fix: Replace ReactMarkdown with a raw preformatted text display (<pre>) for SKILL.md content in both files, since SKILL.md is a specification file where the YAML frontmatter block is a critical visible element per the Microsoft Agent Framework spec.
verification: TypeScript check passes (zero errors), frontend build succeeds. Removed unused ReactMarkdown/rehypeRaw imports from skill-editor.tsx. Awaiting human UI verification.
files_changed: [frontend/src/pages/admin/meta-skills.tsx, frontend/src/pages/admin/skill-editor.tsx]
