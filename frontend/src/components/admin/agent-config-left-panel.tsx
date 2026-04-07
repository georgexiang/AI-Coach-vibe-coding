import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Wrench,
  X,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VoiceLiveModelSelect } from "@/components/admin/voice-live-model-select";
import { InstructionsSection } from "@/components/admin/instructions-section";
import {
  useVoiceLiveInstances,
  useAssignVoiceLiveInstance,
  useUnassignVoiceLiveInstance,
} from "@/hooks/use-voice-live-instances";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";

interface AgentConfigLeftPanelProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
}

export function AgentConfigLeftPanel({
  form,
  profile,
  isNew,
}: AgentConfigLeftPanelProps) {
  const { t } = useTranslation(["admin", "common"]);
  const navigate = useNavigate();

  const { data } = useVoiceLiveInstances();
  const instances = data?.items ?? [];
  const assignMutation = useAssignVoiceLiveInstance();
  const unassignMutation = useUnassignVoiceLiveInstance();

  const currentId = form.watch("voice_live_instance_id");
  const selectedInstance = instances.find((i) => i.id === currentId);

  const [voiceModeEnabled, setVoiceModeEnabled] = useState(
    Boolean(currentId),
  );
  const [knowledgeToolsExpanded, setKnowledgeToolsExpanded] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  // --- VL Instance assign/unassign logic (migrated from voice-avatar-tab.tsx) ---
  const handleInstanceChange = (value: string) => {
    if (value === "__none__") {
      if (currentId && profile?.id) {
        setShowRemoveDialog(true);
      } else {
        form.setValue("voice_live_instance_id", null, { shouldDirty: true });
      }
    } else {
      if (profile?.id) {
        assignMutation.mutate(
          { instanceId: value, hcpProfileId: profile.id },
          {
            onSuccess: () => {
              form.setValue("voice_live_instance_id", value, {
                shouldDirty: true,
              });
              toast.success(t("admin:voiceLive.instanceAssigned"));
            },
            onError: () => {
              toast.error(t("admin:voiceLive.assignError"));
            },
          },
        );
      } else {
        form.setValue("voice_live_instance_id", value, { shouldDirty: true });
      }
    }
  };

  const handleConfirmRemove = () => {
    if (!profile?.id) return;
    unassignMutation.mutate(profile.id, {
      onSuccess: () => {
        form.setValue("voice_live_instance_id", null, { shouldDirty: true });
        toast.success(t("admin:voiceLive.removeInstanceSuccess"));
        setShowRemoveDialog(false);
      },
      onError: () => {
        toast.error(t("admin:voiceLive.assignError"));
        setShowRemoveDialog(false);
      },
    });
  };

  const handleVoiceModeToggle = (checked: boolean) => {
    setVoiceModeEnabled(checked);
    if (!checked) {
      form.setValue("voice_live_instance_id", null, { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Model Deployment */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <Label className="text-xs font-semibold">
            {t("admin:hcp.modelDeployment")}
          </Label>
          <div className="mt-2">
            <VoiceLiveModelSelect
              value={form.watch("voice_live_model")}
              onValueChange={(v) => form.setValue("voice_live_model", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Voice Mode */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold">
                {t("admin:hcp.voiceModeToggle")}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {t("admin:hcp.voiceModeDescription")}
              </p>
            </div>
            <Switch
              checked={voiceModeEnabled}
              onCheckedChange={handleVoiceModeToggle}
              aria-label={t("admin:hcp.voiceModeToggle")}
            />
          </div>

          {voiceModeEnabled && (
            <div className="space-y-2 pt-1">
              <Label className="text-xs text-muted-foreground">
                {t("admin:hcp.vlInstanceLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={currentId ?? "__none__"}
                  onValueChange={handleInstanceChange}
                  disabled={isNew}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue
                      placeholder={t("admin:hcp.vlInstanceNone")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t("admin:hcp.vlInstanceNone")}
                    </SelectItem>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        <span className="flex items-center gap-1.5">
                          {inst.name}
                          <Badge variant="secondary" className="text-[10px]">
                            {inst.voice_live_model}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setShowRemoveDialog(true)}
                    title={t("admin:voiceLive.removeInstance")}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => navigate("/admin/voice-live")}
              >
                <ExternalLink className="size-3 mr-1" />
                {t("admin:voiceLive.goToVlManagement")}
              </Button>
            </div>
          )}

          {isNew && (
            <p className="text-[10px] text-muted-foreground">
              {t("admin:hcp.playgroundDisabledNew")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Instructions Section */}
      <InstructionsSection
        form={form}
        profileId={profile?.id}
        isNew={isNew}
      />

      {/* 4. Knowledge & Tools (collapsible skeleton) */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none pb-2"
          onClick={() => setKnowledgeToolsExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-2">
            {knowledgeToolsExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-semibold">
              {t("admin:hcp.knowledgeAndTools")}
            </CardTitle>
          </div>
        </CardHeader>
        {knowledgeToolsExpanded && (
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="size-4" />
              <span>{t("admin:hcp.knowledgePlaceholder")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="size-4" />
              <span>{t("admin:hcp.toolsPlaceholder")}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Remove Confirm Dialog (migrated from voice-avatar-tab.tsx) */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:voiceLive.removeInstance")}</DialogTitle>
            <DialogDescription>
              {t("admin:voiceLive.removeInstanceConfirm", {
                name: selectedInstance?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
            >
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending
                ? t("common:saving")
                : t("admin:voiceLive.removeInstance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
