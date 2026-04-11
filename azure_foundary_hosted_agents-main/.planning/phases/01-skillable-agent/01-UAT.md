---
status: testing
phase: 01-skillable-agent
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-04-08T06:57:38Z
updated: 2026-04-08T06:57:38Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Import skill_manager module and instantiate SkillManager without errors.
  Load built-in skills from skills/ directory — should discover 2 skills (travel-advisor, code-reviewer).
  No crashes, no import failures.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Import skill_manager module and instantiate SkillManager without errors. Load built-in skills from skills/ directory — should discover 2 skills (travel-advisor, code-reviewer). No crashes, no import failures.
result: [pending]

### 2. SKILL.md Frontmatter Parsing
expected: Parsing travel-advisor/SKILL.md extracts name="travel-advisor", description contains "Travel planning", and content includes "## Role" section. Parsing code-reviewer/SKILL.md extracts name="code-reviewer", description contains "Code review specialist".
result: [pending]

### 3. Instruction Composition
expected: compose_instructions() with a base prompt and loaded skills produces a string containing the base prompt text, "== Skill: travel-advisor ==", and "== Skill: code-reviewer ==" headers, plus the skill content bodies. Token warning is logged if total exceeds max_tokens.
result: [pending]

### 4. AGENT_SKILLS Spec Parsing
expected: load_skills(["local:travel-advisor"]) returns exactly 1 skill with name="travel-advisor". load_skills(["local:nonexistent"]) returns empty list without crashing. Invalid spec without colon is skipped gracefully.
result: [pending]

### 5. Security Validation — Git URLs
expected: load_from_git() rejects URLs that don't match the git URL pattern (e.g., "ftp://evil.com/repo.git", "javascript:alert(1)") by raising SkillLoadError. Valid patterns like "https://github.com/owner/repo.git" and "git@github.com:owner/repo.git" are accepted (clone attempt may fail on network, but validation passes).
result: [pending]

### 6. Security Validation — ClawHub Slugs
expected: load_from_clawhub() rejects slugs containing special characters (e.g., "../etc/passwd", "slug;rm -rf", "slug with spaces") by raising SkillLoadError. Valid slug like "my-skill-123" passes validation.
result: [pending]

### 7. Security Validation — URL Scheme
expected: load_from_url() rejects non-http(s) schemes (e.g., "file:///etc/passwd", "ftp://evil.com/skill.md") by raising SkillLoadError. Only http:// and https:// schemes are accepted.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
