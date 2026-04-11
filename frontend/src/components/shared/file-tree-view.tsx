import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  FolderOpen,
  Folder,
  FileText,
  File,
  FileCode,
  Presentation,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillResource, ResourceType } from "@/types/skill";

/** Sentinel value for the virtual SKILL.md root node */
const SKILL_MD_ID = "__SKILL_MD__" as const;


interface FileTreeViewProps {
  resources: SkillResource[];
  onSelectFile: (resource: SkillResource | "SKILL.md") => void;
  selectedId?: string;
  onUpload?: (files: File[], type: ResourceType) => void;
}

// ---------------------------------------------------------------------------
// File icon resolver
// ---------------------------------------------------------------------------

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "md":
    case "txt":
    case "pdf":
    case "docx":
    case "doc":
      return FileText;
    case "pptx":
    case "ppt":
      return Presentation;
    case "py":
    case "js":
    case "ts":
    case "sh":
    case "json":
      return FileCode;
    default:
      return File;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Internal tree data
// ---------------------------------------------------------------------------

interface FolderNode {
  type: "folder";
  name: string;
  resourceType: ResourceType;
  children: SkillResource[];
}

function buildTree(resources: SkillResource[]): FolderNode[] {
  const groups: Record<string, SkillResource[]> = {};
  for (const r of resources) {
    const rt = r.resource_type;
    if (!groups[rt]) groups[rt] = [];
    groups[rt].push(r);
  }

  const order: ResourceType[] = ["reference", "script", "asset"];
  const labels: Record<string, string> = {
    reference: "references",
    script: "scripts",
    asset: "assets",
  };
  const nodes: FolderNode[] = [];
  for (const rt of order) {
    const items = groups[rt];
    if (items && items.length > 0) {
      nodes.push({
        type: "folder",
        name: labels[rt] ?? rt,
        resourceType: rt as ResourceType,
        children: items,
      });
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileTreeView({
  resources,
  onSelectFile,
  selectedId,
  onUpload,
}: FileTreeViewProps) {
  const { t } = useTranslation("skill");
  const treeRef = useRef<HTMLDivElement>(null);

  const folders = buildTree(resources);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const f of folders) {
      initial.add(f.name);
    }
    return initial;
  });

  // Build flat list for keyboard navigation
  type FlatItem =
    | { kind: "skill-md" }
    | { kind: "folder"; name: string }
    | { kind: "file"; resource: SkillResource };

  const flatItems: FlatItem[] = [];
  flatItems.push({ kind: "skill-md" });
  for (const folder of folders) {
    flatItems.push({ kind: "folder", name: folder.name });
    if (expanded.has(folder.name)) {
      for (const child of folder.children) {
        flatItems.push({ kind: "file", resource: child });
      }
    }
  }

  const [focusIndex, setFocusIndex] = useState(0);

  const toggleFolder = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const selectItem = useCallback(
    (item: FlatItem) => {
      if (item.kind === "skill-md") {
        onSelectFile("SKILL.md");
      } else if (item.kind === "folder") {
        toggleFolder(item.name);
      } else {
        onSelectFile(item.resource);
      }
    },
    [onSelectFile, toggleFolder],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const item = flatItems[focusIndex];
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((i) => Math.min(i + 1, flatItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((i) => Math.max(i - 1, 0));
          break;
        case "ArrowRight":
          e.preventDefault();
          if (item?.kind === "folder" && !expanded.has(item.name)) {
            toggleFolder(item.name);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (item?.kind === "folder" && expanded.has(item.name)) {
            toggleFolder(item.name);
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (item) selectItem(item);
          break;
      }
    },
    [flatItems, focusIndex, expanded, toggleFolder, selectItem],
  );

  // Scroll focused item into view
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const focused = tree.querySelector('[data-focused="true"]');
    if (focused) {
      focused.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

  let flatIndex = -1;

  const isSelected = (id: string) => selectedId === id;

  return (
    <div className="flex flex-col">
      {onUpload && (
        <div className="border-b border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.onchange = () => {
                const files = input.files;
                if (files && files.length > 0) {
                  onUpload(Array.from(files), "reference");
                }
              };
              input.click();
            }}
          >
            <Upload className="size-3.5" />
            {t("fileTree.upload")}
          </Button>
        </div>
      )}

      <div
        ref={treeRef}
        role="tree"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-y-auto py-1 text-sm outline-none"
      >
        {/* SKILL.md root node */}
        {(() => {
          flatIndex++;
          const isFocused = focusIndex === flatIndex;
          return (
            <button
              type="button"
              role="treeitem"
              aria-selected={isSelected(SKILL_MD_ID)}
              data-focused={isFocused}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors",
                isSelected(SKILL_MD_ID) &&
                  "bg-primary/5 border-l-2 border-primary",
                isFocused && "ring-1 ring-inset ring-ring",
              )}
              onClick={() => onSelectFile("SKILL.md")}
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="font-mono text-[13px] font-medium">
                SKILL.md
              </span>
            </button>
          );
        })()}

        {/* Folder groups */}
        {folders.map((folder) => {
          flatIndex++;
          const folderFocused = focusIndex === flatIndex;
          const isExpanded = expanded.has(folder.name);
          return (
            <div key={folder.name} role="group">
              <button
                type="button"
                role="treeitem"
                aria-expanded={isExpanded}
                data-focused={folderFocused}
                className={cn(
                  "flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors",
                  folderFocused && "ring-1 ring-inset ring-ring",
                )}
                onClick={() => toggleFolder(folder.name)}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-90",
                  )}
                />
                {isExpanded ? (
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-mono text-[13px]">{folder.name}/</span>
              </button>

              {isExpanded &&
                folder.children.map((resource) => {
                  flatIndex++;
                  const fileFocused = focusIndex === flatIndex;
                  const Icon = getFileIcon(resource.filename);
                  return (
                    <button
                      key={resource.id}
                      type="button"
                      role="treeitem"
                      aria-selected={isSelected(resource.id)}
                      data-focused={fileFocused}
                      className={cn(
                        "flex w-full items-center gap-2 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors",
                        isSelected(resource.id) &&
                          "bg-primary/5 border-l-2 border-primary",
                        fileFocused && "ring-1 ring-inset ring-ring",
                      )}
                      style={{ paddingLeft: 20 + 12 }}
                      onClick={() => onSelectFile(resource)}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate font-mono text-[13px]">
                        {resource.filename}
                      </span>
                      <span className="mr-3 shrink-0 text-xs text-muted-foreground">
                        {formatSize(resource.file_size)}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}

        {/* Empty state */}
        {resources.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t("fileTree.noResources")}
          </p>
        )}
      </div>
    </div>
  );
}
