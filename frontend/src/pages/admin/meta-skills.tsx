import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  Wand2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  CheckCircle,
  AlertCircle,
  Download,
  FileText,
  FileCode,
  File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import apiClient from "@/api/client";
import { FileTreeView } from "@/components/shared/file-tree-view";
import {
  useMetaSkillResources,
  useMetaSkillResourceContent,
} from "@/hooks/use-meta-skills";
import { downloadMetaSkillResource } from "@/api/meta-skills";
import type { MetaSkill } from "@/types/meta-skill";
import type { SkillResource } from "@/types/skill";

import { ModelSelector } from "@/components/shared/model-selector";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
];

// ---------------------------------------------------------------------------
// Resource info sub-component (mirrors skill-editor pattern)
// ---------------------------------------------------------------------------

function ResourceInfoCard({ resource }: { resource: SkillResource }) {
  const { t } = useTranslation("meta-skill");

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
            {t("resources.type", { defaultValue: "Type" })}:{" "}
            {resource.resource_type}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resource content preview
// ---------------------------------------------------------------------------

function ResourceContentPreview({
  skillType,
  resource,
}: {
  skillType: string;
  resource: SkillResource;
}) {
  const { t } = useTranslation("meta-skill");
  const { data: content, isLoading } = useMetaSkillResourceContent(
    skillType,
    resource.resource_type,
    resource.filename,
  );

  const isMarkdown =
    resource.filename.endsWith(".md") || resource.filename.endsWith(".txt");

  return (
    <div className="p-6 space-y-4">
      <ResourceInfoCard resource={resource} />
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : content ? (
        isMarkdown ? (
          <ScrollArea className="h-[400px]">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-[400px]">
            <pre className="rounded-lg bg-muted/50 p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
              {content}
            </pre>
          </ScrollArea>
        )
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          downloadMetaSkillResource(
            skillType,
            resource.resource_type,
            resource.filename,
          )
        }
      >
        <Download className="mr-2 size-4" />
        {t("resources.download", { defaultValue: "Download" })}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main card per skill type
// ---------------------------------------------------------------------------

function MetaSkillCard({
  skillType,
  icon,
}: {
  skillType: string;
  icon: React.ReactNode;
}) {
  const { t } = useTranslation("meta-skill");
  const [metaSkill, setMetaSkill] = useState<MetaSkill | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editModel, setEditModel] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [editTemplate, setEditTemplate] = useState("");

  // Resource browser state
  const [selectedResource, setSelectedResource] = useState<
    SkillResource | "SKILL.md" | null
  >(null);
  const { data: resources = [], isLoading: resourcesLoading } =
    useMetaSkillResources(skillType);

  // Adapt MetaSkillResource[] to SkillResource[] for FileTreeView
  const adaptedResources: SkillResource[] = resources.map((r) => ({
    ...r,
    skill_id: "",
    version_id: null,
    extraction_status: null,
  }));

  useEffect(() => {
    loadMetaSkill();
  }, [skillType]);

  async function loadMetaSkill() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<MetaSkill>(
        `/meta-skills/${skillType}`,
      );
      setMetaSkill(data);
      setEditModel(data.model);
      setEditLanguage(data.template_language);
      setEditTemplate(data.template_content);
    } catch {
      setMetaSkill(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await apiClient.put<MetaSkill>(
        `/meta-skills/${skillType}`,
        {
          model: editModel,
          template_content: editTemplate,
          template_language: editLanguage,
        },
      );
      setMetaSkill(data);
      toast.success(t("messages.saveSuccess"));
    } catch {
      toast.error(t("messages.syncError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await apiClient.put(`/meta-skills/${skillType}`, {
        model: editModel,
        template_content: editTemplate,
        template_language: editLanguage,
      });
      await apiClient.post(`/meta-skills/${skillType}/sync`);
      toast.success(t("messages.syncSuccess"));
      await loadMetaSkill();
    } catch {
      toast.error(t("messages.syncError"));
    } finally {
      setSyncing(false);
    }
  }

  async function handleLanguageChange(newLang: string) {
    setEditLanguage(newLang);
    try {
      const { data } = await apiClient.get<{ template_content: string }>(
        `/meta-skills/${skillType}/default-template`,
        { params: { language: newLang } },
      );
      setEditTemplate(data.template_content);
    } catch {
      // If no default template for this language, keep current content
    }
  }

  async function handleReset() {
    if (!confirm(t("messages.resetConfirm"))) return;
    setResetting(true);
    try {
      const { data } = await apiClient.post<MetaSkill>(
        `/meta-skills/${skillType}/reset`,
      );
      setMetaSkill(data);
      setEditTemplate(data.template_content);
      setEditModel(data.model);
      setEditLanguage(data.template_language);
      toast.success(t("messages.resetSuccess"));
    } catch {
      toast.error(t("messages.syncError"));
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!metaSkill) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("messages.noAgent")}
        </CardContent>
      </Card>
    );
  }

  const isSynced = !!metaSkill.agent_id;
  const hasChanges =
    editModel !== metaSkill.model ||
    editLanguage !== metaSkill.template_language ||
    editTemplate !== metaSkill.template_content;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {icon}
            <div className="flex-1">
              <CardTitle className="text-lg">
                {metaSkill.display_name}
              </CardTitle>
              <CardDescription>{metaSkill.name}</CardDescription>
            </div>
            <Badge variant={isSynced ? "default" : "secondary"}>
              {isSynced ? (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {t("status.synced")}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t("status.notSynced")}
                </span>
              )}
            </Badge>
          </div>
        </CardHeader>
        {isSynced && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t("fields.agentId")}:{" "}
                </span>
                <span className="font-mono text-xs">{metaSkill.agent_id}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("fields.agentVersion")}:{" "}
                </span>
                <span>{metaSkill.agent_version}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("fields.lastSynced")}:{" "}
                </span>
                <span>
                  {metaSkill.last_synced_at
                    ? new Date(metaSkill.last_synced_at).toLocaleString()
                    : "-"}
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Inner tabs: Instructions vs Resources */}
      <Tabs defaultValue="instructions">
        <TabsList>
          <TabsTrigger value="instructions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("tabs.instructions", { defaultValue: "Agent Instructions" })}
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            {t("tabs.resources", { defaultValue: "Skill Resources" })}
          </TabsTrigger>
        </TabsList>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("fields.model")}</Label>
                  <ModelSelector
                    value={editModel}
                    onValueChange={setEditModel}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("fields.templateLanguage")}</Label>
                  <Select
                    value={editLanguage}
                    onValueChange={handleLanguageChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("fields.composedInstructions", {
                    defaultValue:
                      "Composed Instructions (SKILL.md + References)",
                  })}
                </Label>
                <Textarea
                  value={editTemplate}
                  onChange={(e) => setEditTemplate(e.target.value)}
                  rows={16}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={resetting}
                >
                  {resetting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-1" />
                  )}
                  {t("actions.reset")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {t("actions.save")}
                </Button>
                <Button size="sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {t("actions.sync")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {resourcesLoading ? (
                <div className="p-6">
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_1fr] overflow-hidden">
                  {/* Left: File tree */}
                  <div className="border-b lg:border-b-0 lg:border-r border-border bg-muted/30">
                    <FileTreeView
                      resources={adaptedResources}
                      onSelectFile={setSelectedResource}
                      selectedId={
                        selectedResource === "SKILL.md"
                          ? "__SKILL_MD__"
                          : selectedResource
                            ? (selectedResource as SkillResource).id
                            : undefined
                      }
                    />
                  </div>

                  {/* Right: Preview panel */}
                  <div className="min-h-[400px]">
                    {!selectedResource && (
                      <div className="flex h-full items-center justify-center p-8">
                        <p className="text-sm text-muted-foreground">
                          {t("resources.selectFile", {
                            defaultValue: "Select a file to preview",
                          })}
                        </p>
                      </div>
                    )}

                    {/* SKILL.md preview */}
                    {selectedResource === "SKILL.md" && (
                      <ScrollArea className="h-[500px]">
                        <div className="prose prose-sm max-w-none p-6 dark:prose-invert">
                          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                            {editTemplate || ""}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    )}

                    {/* Resource file preview */}
                    {selectedResource &&
                      selectedResource !== "SKILL.md" && (
                        <ResourceContentPreview
                          skillType={skillType}
                          resource={selectedResource as SkillResource}
                        />
                      )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function MetaSkillsPage() {
  const { t } = useTranslation("meta-skill");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      <Tabs defaultValue="creator">
        <TabsList>
          <TabsTrigger value="creator" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            {t("tabs.creator")}
          </TabsTrigger>
          <TabsTrigger value="evaluator" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            {t("tabs.evaluator")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="creator" className="mt-4">
          <MetaSkillCard
            skillType="creator"
            icon={<Wand2 className="h-5 w-5 text-primary" />}
          />
        </TabsContent>

        <TabsContent value="evaluator" className="mt-4">
          <MetaSkillCard
            skillType="evaluator"
            icon={<ClipboardCheck className="h-5 w-5 text-primary" />}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
