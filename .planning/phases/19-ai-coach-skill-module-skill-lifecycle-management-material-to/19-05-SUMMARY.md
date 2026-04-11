---
phase: 19-ai-coach-skill-module
plan: 05
subsystem: frontend-skill-editor
tags: [skill-editor, sop-editor, file-tree, material-upload, conversion-progress]
dependency_graph:
  requires: [19-02, 19-04]
  provides: [skill-editor-page, sop-editor-component, file-tree-view, conversion-progress, skill-material-uploader]
  affects: [19-06]
tech_stack:
  added: []
  patterns: [dual-mode-editing, live-markdown-preview, keyboard-navigable-tree, conversion-polling]
key_files:
  created:
    - frontend/src/components/shared/sop-editor.tsx
    - frontend/src/components/shared/conversion-progress.tsx
    - frontend/src/components/shared/skill-material-uploader.tsx
    - frontend/src/components/shared/file-tree-view.tsx
  modified:
    - frontend/src/pages/admin/skill-editor.tsx
    - frontend/public/locales/en-US/skill.json
    - frontend/public/locales/zh-CN/skill.json
decisions:
  - "SopEditor uses 2-column layout (3fr/2fr) with live ReactMarkdown preview and rehype-raw for rendering"
  - "FileTreeView builds flat navigation list from resources for keyboard accessibility (ArrowUp/Down/Left/Right)"
  - "ConversionProgress uses CSS variables for purple processing indicator matching UI-SPEC semantic colors"
  - "SkillEditorPage handles new-skill flow: create first -> then upload+convert, or create empty"
metrics:
  duration: "6min"
  completed: "2026-04-11T07:38:00Z"
  tasks: 2
  files: 7
---

# Phase 19 Plan 05: Skill Editor MVP Summary

Skill Editor MVP with dual-mode SOP editing (manual Markdown + AI feedback via regenerate-sop API), VSCode-style FileTreeView with keyboard navigation, ConversionProgress indicator with status polling, and SkillMaterialUploader with react-dropzone supporting PDF/DOCX/PPTX/TXT/MD.

## Tasks Completed

### Task 1: SopEditor, ConversionProgress, SkillMaterialUploader components
**Commit:** eea2bd3

- **SopEditor** (`frontend/src/components/shared/sop-editor.tsx`): Dual-mode editing per D-09. Left column: Markdown textarea with font-mono styling + AI feedback section with "Apply Changes" button that calls `onAiRegenerate`. Right column: Live ReactMarkdown preview with rehype-raw in ScrollArea. Highlight animation on AI content update (bg-primary/5 fade 1500ms). All text via useTranslation("skill").
- **ConversionProgress** (`frontend/src/components/shared/conversion-progress.tsx`): Four status states (pending, processing, completed, failed). Purple Loader2 spinner for active states, green CheckCircle2 + success Badge for completed, destructive AlertCircle banner with retry button for failed (D-08). aria-live="polite" region for accessibility.
- **SkillMaterialUploader** (`frontend/src/components/shared/skill-material-uploader.tsx`): react-dropzone accepting PDF/DOCX/PPTX/TXT/MD (D-05), 50MB max per file, 10 files max. Dashed border drop zone with file list showing name/size/type-icon. Remove individual files before upload. "Upload and Convert" primary button.

### Task 2: FileTreeView and Skill Editor page with Content + Resources tabs
**Commit:** a7ae4fb

- **FileTreeView** (`frontend/src/components/shared/file-tree-view.tsx`): VSCode-style collapsible tree per D-17. Virtual SKILL.md root node always present. Groups resources by type into references/, scripts/, assets/ folders. TreeNode with ChevronRight rotation, FolderOpen/Folder/FileText/FileCode/Presentation icons. Selected state: bg-primary/5 border-l-2 border-primary. 20px indent per level. Full keyboard navigation (ArrowUp/Down/Left/Right, Enter to select). aria-expanded on folders, aria-selected on files. Upload button at top via onUpload prop.
- **SkillEditorPage** (`frontend/src/pages/admin/skill-editor.tsx`): Full editor replacing placeholder. Uses useParams for id, 7 hooks from use-skills.ts. Page header with back link, skill name, Save Draft + Publish Skill buttons. Tabs: Content | Resources | Quality | Settings.
  - **Content tab**: Three states -- (1) New/no content: SkillMaterialUploader + "create empty skill" link, (2) Converting: ConversionProgress with polling via useConversionStatus(id, true) at 3s interval, (3) Content exists: SopEditor with AI regeneration via useRegenerateSop.
  - **Resources tab**: 2-column (280px/1fr) layout with FileTreeView on left, preview panel on right. SKILL.md renders Markdown, reference/asset files show info card + download button, script files show monospace block.
  - Quality/Settings tabs: placeholder "Coming soon" (Plan 06).
- **i18n**: Added 19 new keys to en-US/skill.json and zh-CN/skill.json covering editor, dropzone, file tree, and status labels.
- **Router**: Already configured in Plan 04 -- /admin/skills/new and /admin/skills/:id/edit routes.

## Decisions Made

1. SopEditor uses 2-column grid (3fr/2fr) matching UI-SPEC Content tab layout with live ReactMarkdown preview
2. FileTreeView builds a flat navigation array from the tree for consistent keyboard navigation behavior
3. ConversionProgress uses CSS variable `var(--improvement)` for purple processing indicator per UI-SPEC
4. SkillEditorPage new-skill flow: createSkill first, then uploadAndConvert (because API requires skill ID)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` -- exits 0 (zero errors)
- `npm run build` -- succeeds (built in ~3.7s)
- All acceptance criteria verified: exports, props, imports, aria attributes present

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Quality tab placeholder | frontend/src/pages/admin/skill-editor.tsx | Implemented in Plan 06 |
| Settings tab placeholder | frontend/src/pages/admin/skill-editor.tsx | Implemented in Plan 06 |
| Publish button disabled | frontend/src/pages/admin/skill-editor.tsx | PublishGateDialog in Plan 06 |

## Self-Check: PASSED

All 7 created/modified files exist on disk. Both task commits (eea2bd3, a7ae4fb) verified in git log.
