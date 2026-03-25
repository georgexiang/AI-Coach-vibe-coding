import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { Button, Separator, Switch } from "@/components/ui";
import { SubStateBadge } from "./sub-state-badge";
import type { ConferenceSession, ConferenceSubState } from "@/types/conference";

interface ConferenceHeaderProps {
  session: ConferenceSession | undefined;
  subState: ConferenceSubState;
  onEndSession: () => void;
  onVoiceToggle: (enabled: boolean) => void;
  voiceEnabled: boolean;
  featureVoiceEnabled: boolean;
  sessionTime: string;
}

export function ConferenceHeader({
  session,
  subState,
  onEndSession,
  onVoiceToggle,
  voiceEnabled,
  featureVoiceEnabled,
  sessionTime,
}: ConferenceHeaderProps) {
  const { t } = useTranslation("conference");

  return (
    <div className="flex h-16 items-center border-b px-4">
      {/* Left: Timer + Topic */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          <span className="font-mono text-sm">{sessionTime}</span>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <span className="max-w-[300px] truncate text-sm font-medium text-foreground">
          {session?.presentationTopic ?? t("title")}
        </span>
      </div>

      {/* Center: Sub-state badge */}
      <div className="flex flex-1 justify-center">
        <SubStateBadge subState={subState} />
      </div>

      {/* Right: Voice toggle + End button */}
      <div className="flex items-center gap-3">
        {featureVoiceEnabled && (
          <div className="flex items-center gap-2">
            <Switch
              checked={voiceEnabled}
              onCheckedChange={onVoiceToggle}
            />
            <span className="text-xs text-muted-foreground">
              {t("voiceMode")}
            </span>
          </div>
        )}
        <Button variant="destructive" size="sm" onClick={onEndSession}>
          {t("endPresentation")}
        </Button>
      </div>
    </div>
  );
}
