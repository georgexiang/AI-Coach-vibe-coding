import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, Save, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useActivateVersion,
  useAdoptRun,
  useOptimizePrompt,
  usePrompt,
  usePromptVersions,
  useSaveVersion,
} from "@/hooks/use-prompts";
import type { OptimizeMode } from "@/types/prompt";

export default function PromptEditorPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("prompts");

  const { data: prompt, isError } = usePrompt(key);
  const { data: versions } = usePromptVersions(key);
  const saveMutation = useSaveVersion(key);
  const activateMutation = useActivateVersion(key);
  const optimizeMutation = useOptimizePrompt(key);
  const adoptMutation = useAdoptRun(key);

  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<OptimizeMode>("system");
  const [requirements, setRequirements] = useState("");
  const [optimized, setOptimized] = useState<{ runId: string; text: string } | null>(null);

  useEffect(() => {
    if (prompt?.active_version) {
      setContent(prompt.active_version.content);
    }
  }, [prompt]);

  if (isError) {
    return <div className="p-6 text-sm text-danger-600">{t("editor.loadError")}</div>;
  }

  const handleSave = () => {
    saveMutation.mutate(
      { content, note },
      {
        onSuccess: () => {
          toast.success(t("editor.saved"));
          setNote("");
        },
      },
    );
  };

  const handleRollback = (versionNo: number) => {
    activateMutation.mutate(versionNo, {
      onSuccess: () => toast.success(t("editor.rolledBack")),
    });
  };

  const handleOptimize = () => {
    optimizeMutation.mutate(
      { mode, requirements: mode === "iterate" ? requirements : null },
      {
        onSuccess: (res) => setOptimized({ runId: res.run_id, text: res.optimized_prompt }),
        onError: () => toast.error(t("optimize.failed")),
      },
    );
  };

  const handleAdopt = () => {
    if (!optimized) return;
    adoptMutation.mutate(
      { run_id: optimized.runId },
      {
        onSuccess: () => {
          toast.success(t("optimize.adopted"));
          setDialogOpen(false);
          setOptimized(null);
        },
      },
    );
  };

  const openOptimize = () => {
    setOptimized(null);
    setRequirements("");
    setMode("system");
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/admin/prompts")}>
          <ArrowLeft className="size-4" />
          {t("editor.back")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openOptimize} data-testid="optimize-open">
            <Sparkles className="size-4" />
            {t("editor.optimize")}
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="save-version">
            <Save className="size-4" />
            {t("editor.save")}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-medium text-foreground">{prompt?.name ?? key}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{key}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.placeholders")}</CardTitle>
        </CardHeader>
        <CardContent>
          {prompt?.variables && prompt.variables.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {prompt.variables.map((v) => (
                <Badge key={v} variant="secondary" className="font-mono">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("editor.noPlaceholders")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.content")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="font-mono text-sm"
            data-testid="prompt-content"
          />
          <div className="space-y-2">
            <Label htmlFor="version-note">{t("editor.note")}</Label>
            <Input
              id="version-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("editor.notePlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("editor.versionHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" data-testid="version-history">
            {(versions ?? []).map((version) => (
              <li
                key={version.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {t("editor.versionLabel", { no: version.version_no })}
                  </span>
                  <Badge variant="outline">{version.source}</Badge>
                  {version.is_active && (
                    <Badge className={cn("bg-success-600")}>{t("editor.active")}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(version.created_at).toLocaleString()}
                  </span>
                </div>
                {!version.is_active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRollback(version.version_no)}
                    data-testid={`rollback-${version.version_no}`}
                  >
                    <RotateCcw className="size-4" />
                    {t("editor.rollback")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("optimize.title")}</DialogTitle>
            <DialogDescription>{t("optimize.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("optimize.mode")}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as OptimizeMode)}>
                <SelectTrigger className="w-full" data-testid="optimize-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t("optimize.modeSystem")}</SelectItem>
                  <SelectItem value="user">{t("optimize.modeUser")}</SelectItem>
                  <SelectItem value="iterate">{t("optimize.modeIterate")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "iterate" && (
              <div className="space-y-2">
                <Label htmlFor="optimize-requirements">{t("optimize.requirements")}</Label>
                <Textarea
                  id="optimize-requirements"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder={t("optimize.requirementsPlaceholder")}
                  rows={3}
                />
              </div>
            )}

            {optimized && (
              <div className="grid grid-cols-2 gap-4" data-testid="optimize-diff">
                <div className="space-y-1">
                  <Label>{t("optimize.original")}</Label>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                    {content}
                  </pre>
                </div>
                <div className="space-y-1">
                  <Label>{t("optimize.optimized")}</Label>
                  <pre
                    className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-success-50 p-3 text-xs"
                    data-testid="optimized-text"
                  >
                    {optimized.text}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("optimize.cancel")}
            </Button>
            {optimized ? (
              <Button
                onClick={handleAdopt}
                disabled={adoptMutation.isPending}
                data-testid="adopt-run"
              >
                {t("optimize.adopt")}
              </Button>
            ) : (
              <Button
                onClick={handleOptimize}
                disabled={
                  optimizeMutation.isPending || (mode === "iterate" && !requirements.trim())
                }
                data-testid="run-optimize"
              >
                <Sparkles className="size-4" />
                {optimizeMutation.isPending ? t("optimize.running") : t("optimize.run")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
