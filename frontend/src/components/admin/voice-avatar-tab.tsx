import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { ExternalLink, X, Volume2, Monitor } from "lucide-react";
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
import {
  useVoiceLiveInstances,
  useAssignVoiceLiveInstance,
  useUnassignVoiceLiveInstance,
} from "@/hooks/use-voice-live-instances";
import { VOICE_LIVE_MODEL_OPTIONS } from "@/components/admin/voice-live-model-select";
import { AVATAR_CHARACTER_MAP, getAvatarInitials } from "@/data/avatar-characters";
import { cn } from "@/lib/utils";
import type { HcpFormValues } from "@/pages/admin/hcp-profile-editor";
import type { HcpProfile } from "@/types/hcp";

interface VoiceAvatarTabProps {
  form: UseFormReturn<HcpFormValues>;
  profile?: HcpProfile;
  isNew: boolean;
}

/** Get a human-readable label for a voice live model value. */
function getModelLabel(value: string): string {
  const opt = VOICE_LIVE_MODEL_OPTIONS.find((m) => m.value === value);
  return opt ? opt.value : value;
}

export function VoiceAvatarTab({ form, profile, isNew }: VoiceAvatarTabProps) {
  const { t } = useTranslation(["admin", "common"]);
  const navigate = useNavigate();

  const { data } = useVoiceLiveInstances();
  const instances = data?.items ?? [];
  const assignMutation = useAssignVoiceLiveInstance();
  const unassignMutation = useUnassignVoiceLiveInstance();

  const currentId = form.watch("voice_live_instance_id");
  const selectedInstance = instances.find((i) => i.id === currentId);

  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  const handleInstanceChange = (value: string) => {
    if (value === "__none__") {
      // If currently assigned, prompt to unassign
      if (currentId && profile?.id) {
        setShowRemoveDialog(true);
      } else {
        form.setValue("voice_live_instance_id", null, { shouldDirty: true });
      }
    } else {
      // Assign new instance
      if (profile?.id) {
        assignMutation.mutate(
          { instanceId: value, hcpProfileId: profile.id },
          {
            onSuccess: () => {
              form.setValue("voice_live_instance_id", value, { shouldDirty: true });
              toast.success(t("admin:voiceLive.instanceAssigned"));
            },
            onError: () => {
              toast.error(t("admin:voiceLive.assignError"));
            },
          },
        );
      } else {
        // New profile — just set form value, actual assign happens on save
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

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Section 1: Instance Selector */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              {t("admin:voiceLive.selectInstance")}
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={currentId ?? "__none__"}
                onValueChange={handleInstanceChange}
                disabled={isNew}
              >
                <SelectTrigger className="h-9 text-sm flex-1">
                  <SelectValue
                    placeholder={t("admin:voiceLive.selectInstancePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("admin:voiceLive.noInstance")}
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
            {isNew && (
              <p className="text-[10px] text-muted-foreground">
                {t("admin:voiceLive.migrateHint")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Read-Only Configuration Preview (when instance assigned) */}
      {selectedInstance && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              {t("admin:voiceLive.configPreview")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <ConfigRow label={t("admin:voiceLive.previewModel")}>
                <Badge variant="secondary">{getModelLabel(selectedInstance.voice_live_model)}</Badge>
              </ConfigRow>
              <ConfigRow label={t("admin:voiceLive.previewVoice")}>
                <span className="flex items-center gap-1.5 text-sm">
                  <Volume2 className="size-3.5 text-muted-foreground" />
                  {selectedInstance.voice_name}
                </span>
              </ConfigRow>
              <ConfigRow label={t("admin:voiceLive.previewAvatar")}>
                <span className="flex items-center gap-2">
                  <AvatarThumbnail character={selectedInstance.avatar_character} style={selectedInstance.avatar_style} />
                  <span className="text-sm capitalize">{selectedInstance.avatar_character}</span>
                  {selectedInstance.avatar_style && (
                    <span className="text-muted-foreground text-xs capitalize">({selectedInstance.avatar_style.replace(/-/g, " ")})</span>
                  )}
                </span>
              </ConfigRow>
              <ConfigRow label={t("admin:voiceLive.previewTemperature")}>
                <span className="text-sm">{selectedInstance.voice_temperature.toFixed(1)}</span>
              </ConfigRow>
              <ConfigRow label={t("admin:voiceLive.previewTurnDetection")}>
                <span className="text-sm">{selectedInstance.turn_detection_type.replace(/_/g, " ")}</span>
              </ConfigRow>
              <ConfigRow label={t("admin:voiceLive.previewLanguage")}>
                <span className="text-sm">{selectedInstance.recognition_language === "auto" ? "Auto Detect" : selectedInstance.recognition_language}</span>
              </ConfigRow>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center gap-2">
              <Badge variant={selectedInstance.enabled ? "default" : "outline"}>
                {selectedInstance.enabled ? "Enabled" : "Disabled"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("admin:voiceLive.instanceHcpCount", { count: selectedInstance.hcp_count })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: No Instance Hint (when no instance assigned) */}
      {!selectedInstance && !isNew && (
        <div className="bg-muted/50 rounded-lg p-6 flex flex-col items-center text-center gap-3">
          <Monitor className="size-10 text-muted-foreground/50" />
          <h3 className="text-sm font-semibold">
            {t("admin:voiceLive.noInstanceAssigned")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            {t("admin:voiceLive.readOnlyDescription")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/voice-live")}
          >
            <ExternalLink className="size-3.5 mr-1.5" />
            {t("admin:voiceLive.goToVlManagement")}
          </Button>
        </div>
      )}

      {/* Remove Confirm Dialog */}
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
              {t("common:cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending
                ? t("common:saving", "Removing...")
                : t("admin:voiceLive.removeInstance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

const CDN_BASE = "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/media";

function AvatarThumbnail({ character, style }: { character: string; style: string }) {
  const charMeta = AVATAR_CHARACTER_MAP.get(character);
  const [imgFailed, setImgFailed] = useState(false);
  if (!charMeta || imgFailed) {
    const initials = charMeta ? getAvatarInitials(charMeta.displayName) : character.charAt(0).toUpperCase();
    return (
      <div className={cn("w-8 aspect-[3/4] rounded-md flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br", charMeta?.gradientClasses ?? "from-gray-500 to-gray-700")}>
        {initials}
      </div>
    );
  }
  const thumbUrl = charMeta.isPhotoAvatar ? charMeta.thumbnailUrl : style ? `${CDN_BASE}/${charMeta.id}-${style}.png` : charMeta.thumbnailUrl;
  return (
    <div className="w-8 aspect-[3/4] overflow-hidden rounded-md bg-muted/30">
      <img src={thumbUrl} alt={charMeta.displayName} className="size-full object-contain" onError={() => setImgFailed(true)} />
    </div>
  );
}
