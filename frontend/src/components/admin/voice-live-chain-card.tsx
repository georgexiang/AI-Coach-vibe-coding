import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, Users, Mic, UserPlus } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "@/components/ui";
import { VOICE_LIVE_MODEL_OPTIONS } from "@/components/admin/voice-live-model-select";
import {
  AVATAR_CHARACTER_MAP,
  getAvatarInitials,
} from "@/data/avatar-characters";
import { cn } from "@/lib/utils";
import type { VoiceLiveInstance } from "@/types/voice-live";

interface VoiceLiveInstanceCardProps {
  instance: VoiceLiveInstance;
  onEdit: (instance: VoiceLiveInstance) => void;
  onDelete: (instance: VoiceLiveInstance) => void;
  onAssign?: (instance: VoiceLiveInstance) => void;
}

function getModelLabel(modelId: string, t: (key: string) => string): string {
  const option = VOICE_LIVE_MODEL_OPTIONS.find((m) => m.value === modelId);
  return option ? t(`hcp.${option.i18nKey}`) : modelId;
}

export function VoiceLiveInstanceCard({
  instance,
  onEdit,
  onDelete,
  onAssign,
}: VoiceLiveInstanceCardProps) {
  const { t } = useTranslation("admin");
  const charMeta = AVATAR_CHARACTER_MAP.get(instance.avatar_character);
  const failedRef = useRef(false);
  const [, forceUpdate] = useState(0);

  const handleImgError = useCallback(() => {
    if (!failedRef.current) {
      failedRef.current = true;
      forceUpdate((n) => n + 1);
    }
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {/* Avatar thumbnail */}
          <div className="size-10 shrink-0 overflow-hidden rounded-full">
            {charMeta && !failedRef.current ? (
              <img
                src={charMeta.thumbnailUrl}
                alt={charMeta.displayName}
                className="size-full object-cover"
                onError={handleImgError}
                loading="lazy"
              />
            ) : (
              <div
                className={cn(
                  "flex size-full items-center justify-center bg-gradient-to-br text-sm font-bold text-white",
                  charMeta?.gradientClasses ?? "from-gray-500 to-gray-700",
                )}
              >
                {charMeta
                  ? getAvatarInitials(charMeta.displayName)
                  : instance.avatar_character.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{instance.name}</span>
              <Badge variant={instance.enabled ? "default" : "secondary"}>
                {instance.enabled
                  ? t("voiceLive.instanceEnabled")
                  : t("voiceLive.statusDisabled")}
              </Badge>
            </div>
            {instance.description && (
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {instance.description}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-2">
        {/* Model */}
        <div className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">
            {t("voiceLive.instanceModel")}
          </span>
          <span className="truncate">
            {getModelLabel(instance.voice_live_model, t)}
          </span>
        </div>
        {/* Voice */}
        <div className="flex items-center gap-2 text-sm">
          <Mic className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{instance.voice_name}</span>
        </div>
        {/* Avatar character + style */}
        <div className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">
            {t("voiceLive.instanceAvatar")}
          </span>
          <span className="truncate capitalize">
            {instance.avatar_character}
            {instance.avatar_style ? ` - ${instance.avatar_style}` : ""}
          </span>
        </div>
        {/* HCP count */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="size-3.5 shrink-0 text-muted-foreground" />
          <span>
            {instance.hcp_count > 0
              ? t("voiceLive.instanceHcpCount", {
                  count: instance.hcp_count,
                })
              : t("voiceLive.instanceNoHcps")}
          </span>
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => onEdit(instance)}
        >
          <Pencil className="mr-1 size-3" />
          {t("voiceLive.editInstance")}
        </Button>
        {onAssign && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onAssign(instance)}
          >
            <UserPlus className="mr-1 size-3" />
            {t("voiceLive.assignToHcp")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(instance)}
          disabled={instance.hcp_count > 0}
        >
          <Trash2 className="mr-1 size-3" />
          {t("voiceLive.deleteInstance")}
        </Button>
      </CardFooter>
    </Card>
  );
}
