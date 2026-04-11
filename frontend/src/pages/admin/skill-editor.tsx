import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  ArrowLeft,
  Save,
  Rocket,
  RefreshCw,
  Download,
  FileText,
  FileCode,
  File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SopEditor } from "@/components/shared/sop-editor";
import { ConversionProgress } from "@/components/shared/conversion-progress";
import { SkillMaterialUploader } from "@/components/shared/skill-material-uploader";
import { FileTreeView } from "@/components/shared/file-tree-view";
import {
  useSkill,
  useUpdateSkill,
  useCreateSkill,
  useRegenerateSop,
  useConversionStatus,
  useUploadAndConvert,
  useUploadResources,
  useRetryConversion,
  skillKeys,
} from "@/hooks/use-skills";
import { downloadResource } from "@/api/skills";
import { useQueryClient } from "@tanstack/react-query";
import type { SkillResource, ConversionStatus } from "@/types/skill";

const VALID_TABS = new Set(["content", "resources", "quality", "settings"]);

export default function SkillEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("skill");
  const queryClient = useQueryClient();

  const isNew = !id;

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------
  const { data: skill, isLoading } = useSkill(id);
  const updateMutation = useUpdateSkill();
  const createMutation = useCreateSkill();
  const regenerateMutation = useRegenerateSop();
  const uploadConvertMutation = useUploadAndConvert();
  const uploadResourcesMutation = useUploadResources();
  const retryConversionMutation = useRetryConversion();

  // Conversion polling: active when status is pending/processing
  const isConverting =
    skill?.conversion_status === "pending" ||
    skill?.conversion_status === "processing";
  const { data: conversionData } = useConversionStatus(id ?? "", isConverting);

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState("content");
  const [sopContent, setSopContent] = useState("");
  const [contentDirty, setContentDirty] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [selectedResource, setSelectedResource] = useState<
    SkillResource | "SKILL.md" | null
  >(null);

  // Sync local state from fetched skill
  useEffect(() => {
    if (skill) {
      setSopContent(skill.content ?? "");
      setContentDirty(false);
    }
  }, [skill]);

  // On conversion completed, refetch skill
  useEffect(() => {
    if (
      conversionData?.status === "completed" &&
      skill?.conversion_status !== "completed"
    ) {
      queryClient.invalidateQueries({ queryKey: skillKeys.detail(id ?? "") });
    }
  }, [conversionData?.status, skill?.conversion_status, id, queryClient]);

  const handleTabChange = (value: string) => {
    setActiveTab(VALID_TABS.has(value) ? value : "content");
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleSaveDraft = useCallback(async () => {
    if (isNew) {
      createMutation.mutate(
        { name: "New Skill", content: sopContent },
        {
          onSuccess: (created) => {
            toast.success(
              t("editor.saved", { defaultValue: "Draft saved" }),
            );
            navigate(`/admin/skills/${created.id}/edit`, { replace: true });
          },
          onError: () => toast.error(t("errors.saveFailed")),
        },
      );
    } else if (id) {
      updateMutation.mutate(
        { id, data: { content: sopContent } },
        {
          onSuccess: () => {
            setContentDirty(false);
            toast.success(
              t("editor.saved", { defaultValue: "Draft saved" }),
            );
          },
          onError: () => toast.error(t("errors.saveFailed")),
        },
      );
    }
  }, [isNew, id, sopContent, createMutation, updateMutation, navigate, t]);

  const handleContentChange = useCallback((content: string) => {
    setSopContent(content);
    setContentDirty(true);
  }, []);

  const handleAiRegenerate = useCallback(
    async (feedback: string) => {
      if (!id) return;
      await regenerateMutation.mutateAsync({ id, feedback });
      // Trigger highlight animation
      setHighlighted(true);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlighted(false), 1500);
    },
    [id, regenerateMutation],
  );

  const handleMaterialUpload = useCallback(
    (files: File[]) => {
      if (isNew) {
        // Create skill first, then upload and convert
        createMutation.mutate(
          { name: "New Skill" },
          {
            onSuccess: (created) => {
              navigate(`/admin/skills/${created.id}/edit`, { replace: true });
              uploadConvertMutation.mutate(
                { id: created.id, files },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({
                      queryKey: skillKeys.detail(created.id),
                    });
                  },
                  onError: () => toast.error(t("errors.conversionFailed")),
                },
              );
            },
            onError: () => toast.error(t("errors.saveFailed")),
          },
        );
      } else if (id) {
        uploadConvertMutation.mutate(
          { id, files },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({
                queryKey: skillKeys.detail(id),
              });
            },
            onError: () => toast.error(t("errors.conversionFailed")),
          },
        );
      }
    },
    [isNew, id, createMutation, uploadConvertMutation, navigate, queryClient, t],
  );

  const handleCreateEmpty = useCallback(() => {
    createMutation.mutate(
      { name: "New Skill", content: "" },
      {
        onSuccess: (created) => {
          navigate(`/admin/skills/${created.id}/edit`, { replace: true });
        },
        onError: () => toast.error(t("errors.saveFailed")),
      },
    );
  }, [createMutation, navigate, t]);

  const handleRetryConversion = useCallback(() => {
    if (!id) return;
    retryConversionMutation.mutate(id, {
      onError: () => toast.error(t("errors.conversionFailed")),
    });
  }, [id, retryConversionMutation, t]);

  const handleResourceUpload = useCallback(
    (files: File[], type: "reference" | "script" | "asset") => {
      if (!id) return;
      uploadResourcesMutation.mutate(
        { id, files, resourceType: type },
        {
          onSuccess: () =>
            toast.success(
              t("editor.filesUploaded", {
                defaultValue: "Files uploaded",
              }),
            ),
          onError: () => toast.error(t("errors.saveFailed")),
        },
      );
    },
    [id, uploadResourcesMutation, t],
  );

  const handleDownloadResource = useCallback(
    async (resource: SkillResource) => {
      if (!id) return;
      try {
        await downloadResource(id, resource.id, resource.filename);
      } catch {
        toast.error(t("errors.loadFailed"));
      }
    },
    [id, t],
  );

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const conversionStatus: ConversionStatus | null =
    (conversionData?.status as ConversionStatus | undefined) ??
    skill?.conversion_status ??
    null;
  const conversionError = conversionData?.error ?? skill?.conversion_error ?? undefined;
  const hasContent = Boolean(skill?.content);
  const isProcessing =
    conversionStatus === "pending" || conversionStatus === "processing";
  const isSaving = updateMutation.isPending || createMutation.isPending;

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 flex-1" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/skills")}
          >
            <ArrowLeft className="mr-1 size-4" />
            {t("editor.backToHub")}
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            {isNew
              ? t("editor.createNew", { defaultValue: "Create New Skill" })
              : `${t("hub.title", { defaultValue: "Skill" })}: ${skill?.name ?? ""}`}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving || (!contentDirty && !isNew)}
          >
            {isSaving ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {t("editor.saveDraft")}
          </Button>
          <Button disabled title={t("editor.publishComingSoon", { defaultValue: "Available after quality review" })}>
            <Rocket className="mr-2 size-4" />
            {t("editor.publishSkill")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full bg-muted/60 border">
          <TabsTrigger
            value="content"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("editor.tabContent")}
          </TabsTrigger>
          <TabsTrigger
            value="resources"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("editor.tabResources")}
          </TabsTrigger>
          <TabsTrigger
            value="quality"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("editor.tabQuality")}
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {t("editor.tabSettings")}
          </TabsTrigger>
        </TabsList>

        {/* ----- Content Tab ----- */}
        <TabsContent value="content" className="mt-6">
          {/* New skill without content: show upload zone */}
          {(isNew || (!hasContent && !isProcessing && conversionStatus !== "failed")) && (
            <div className="space-y-6">
              <SkillMaterialUploader
                onUpload={handleMaterialUpload}
                isUploading={uploadConvertMutation.isPending}
              />
              {isNew && (
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-primary underline hover:text-primary/80"
                    onClick={handleCreateEmpty}
                  >
                    {t("editor.createEmpty", {
                      defaultValue: "or create an empty skill",
                    })}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Converting: show progress */}
          {isProcessing && (
            <ConversionProgress
              status={conversionStatus}
              error={conversionError}
              onRetry={handleRetryConversion}
            />
          )}

          {/* Conversion failed: show error */}
          {conversionStatus === "failed" && (
            <ConversionProgress
              status={conversionStatus}
              error={conversionError}
              onRetry={handleRetryConversion}
            />
          )}

          {/* Content exists: show SOP editor */}
          {hasContent && !isProcessing && (
            <SopEditor
              content={sopContent}
              onChange={handleContentChange}
              onAiRegenerate={handleAiRegenerate}
              isRegenerating={regenerateMutation.isPending}
              highlighted={highlighted}
            />
          )}
        </TabsContent>

        {/* ----- Resources Tab ----- */}
        <TabsContent value="resources" className="mt-6">
          {!isNew && skill ? (
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_1fr] rounded-lg border border-border overflow-hidden">
              {/* Left: File tree */}
              <div className="border-b lg:border-b-0 lg:border-r border-border bg-muted/30">
                <FileTreeView
                  resources={skill.resources}
                  onSelectFile={setSelectedResource}
                  selectedId={
                    selectedResource === "SKILL.md"
                      ? "__SKILL_MD__"
                      : selectedResource
                        ? (selectedResource as SkillResource).id
                        : undefined
                  }
                  onUpload={handleResourceUpload}
                />
              </div>

              {/* Right: Preview panel */}
              <div className="min-h-[400px]">
                {!selectedResource && (
                  <div className="flex h-full items-center justify-center p-8">
                    <p className="text-sm text-muted-foreground">
                      {t("fileTree.selectFile")}
                    </p>
                  </div>
                )}

                {/* SKILL.md preview */}
                {selectedResource === "SKILL.md" && (
                  <ScrollArea className="h-[500px]">
                    <div className="prose prose-sm max-w-none p-6 dark:prose-invert">
                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                        {skill.content || ""}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                )}

                {/* Resource file preview */}
                {selectedResource &&
                  selectedResource !== "SKILL.md" &&
                  (() => {
                    const resource = selectedResource as SkillResource;
                    const isScript = resource.resource_type === "script";
                    return (
                      <div className="p-6 space-y-4">
                        <ResourceInfoCard resource={resource} />
                        {isScript && (
                          <pre className="rounded-lg bg-muted/50 p-4 text-sm font-mono overflow-x-auto">
                            {resource.filename}
                          </pre>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadResource(resource)}
                        >
                          <Download className="mr-2 size-4" />
                          {t("fileTree.download")}
                        </Button>
                      </div>
                    );
                  })()}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border bg-muted/50 py-24 text-muted-foreground">
              {t("editor.saveFirstForResources", {
                defaultValue: "Save the skill first to manage resources",
              })}
            </div>
          )}
        </TabsContent>

        {/* ----- Quality Tab (Plan 06 placeholder) ----- */}
        <TabsContent value="quality" className="mt-6">
          <div className="flex items-center justify-center rounded-lg border bg-muted/50 py-24 text-muted-foreground">
            {t("editor.comingSoon", { defaultValue: "Coming soon" })}
          </div>
        </TabsContent>

        {/* ----- Settings Tab (Plan 06 placeholder) ----- */}
        <TabsContent value="settings" className="mt-6">
          <div className="flex items-center justify-center rounded-lg border bg-muted/50 py-24 text-muted-foreground">
            {t("editor.comingSoon", { defaultValue: "Coming soon" })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resource info sub-component
// ---------------------------------------------------------------------------

function ResourceInfoCard({ resource }: { resource: SkillResource }) {
  const { t } = useTranslation("skill");

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getIcon(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (["py", "js", "ts", "sh", "json"].includes(ext)) return FileCode;
    if (["md", "txt", "pdf", "docx", "doc"].includes(ext)) return FileText;
    return FileIcon;
  }

  const Icon = getIcon(resource.filename);

  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
      <Icon className="mt-0.5 size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{resource.filename}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{resource.content_type}</span>
          <span>{formatSize(resource.file_size)}</span>
          <span>
            {t("fileTree.type", { defaultValue: "Type" })}: {resource.resource_type}
          </span>
          <span>
            {new Date(resource.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
