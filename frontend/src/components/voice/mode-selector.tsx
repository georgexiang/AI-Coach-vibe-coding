import { useTranslation } from "react-i18next";
import { MessageSquare, Mic, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { SessionMode } from "@/types/voice-live";

interface ModeSelectorProps {
  value: SessionMode;
  onChange: (mode: SessionMode) => void;
  voiceLiveAvailable: boolean;
  avatarAvailable: boolean;
  disabled?: boolean;
}

interface ModeOption {
  mode: SessionMode;
  icon: typeof MessageSquare;
  labelKey: string;
  alwaysAvailable: boolean;
  unavailableKey: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "text",
    icon: MessageSquare,
    labelKey: "mode.text",
    alwaysAvailable: true,
    unavailableKey: "",
  },
  {
    mode: "voice",
    icon: Mic,
    labelKey: "mode.voice",
    alwaysAvailable: false,
    unavailableKey: "notConfigured",
  },
  {
    mode: "avatar",
    icon: User,
    labelKey: "mode.avatar",
    alwaysAvailable: false,
    unavailableKey: "avatarNotConfigured",
  },
];

/**
 * Segmented control for text/voice/avatar session mode.
 * Text mode always available; voice/avatar gated by availability props.
 */
export function ModeSelector({
  value,
  onChange,
  voiceLiveAvailable,
  avatarAvailable,
  disabled = false,
}: ModeSelectorProps) {
  const { t } = useTranslation("voice");

  const isAvailable = (option: ModeOption): boolean => {
    if (option.alwaysAvailable) return true;
    if (option.mode === "voice") return voiceLiveAvailable;
    if (option.mode === "avatar") return avatarAvailable;
    return false;
  };

  return (
    <div className="flex h-12 flex-col items-center gap-1">
      <p className="text-xs text-muted-foreground">{t("modeSelector")}</p>
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup">
        {MODE_OPTIONS.map((option) => {
          const available = isAvailable(option);
          const isActive = value === option.mode;
          const Icon = option.icon;
          const isDisabled = disabled || !available;

          const button = (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={t(option.labelKey)}
              disabled={isDisabled}
              onClick={() => {
                if (available && !disabled) {
                  onChange(option.mode);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                isDisabled && "opacity-50 cursor-not-allowed",
              )}
              data-testid={`mode-${option.mode}`}
            >
              <Icon className="h-4 w-4" />
              <span>{t(option.labelKey)}</span>
            </button>
          );

          if (!available && option.unavailableKey) {
            return (
              <Tooltip key={option.mode}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>{t(option.unavailableKey)}</TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </div>
  );
}
