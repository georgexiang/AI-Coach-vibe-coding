import { useTranslation } from "react-i18next";
import { MessageSquare, Mic, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { UnifiedSessionMode } from "@/types/unified-session";

interface ModeSwitchBarProps {
  currentMode: UnifiedSessionMode;
  onSwitchMode: (mode: UnifiedSessionMode) => void;
  isSwitching: boolean;
  disabled?: boolean;
}

const MODE_CONFIG: {
  mode: UnifiedSessionMode;
  icon: typeof MessageSquare;
  labelKey: string;
}[] = [
  { mode: "text", icon: MessageSquare, labelKey: "mode.text" },
  { mode: "voice", icon: Mic, labelKey: "mode.voice" },
  { mode: "digital_human", icon: User, labelKey: "mode.digitalHuman" },
];

/**
 * In-session mode switcher buttons (D-04).
 * Shows 3 mode options with active state highlighting.
 * Loading spinner on target button while switching.
 */
export function ModeSwitchBar({
  currentMode,
  onSwitchMode,
  isSwitching,
  disabled = false,
}: ModeSwitchBarProps) {
  const { t } = useTranslation("session");

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
      {MODE_CONFIG.map(({ mode, icon: Icon, labelKey }) => {
        const isActive = currentMode === mode;
        const isLoading = isSwitching && !isActive;

        return (
          <Button
            key={mode}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onSwitchMode(mode)}
            disabled={disabled || isActive || isSwitching}
            className={cn(
              "gap-1.5 text-xs",
              isActive && "pointer-events-none",
            )}
            data-testid={`mode-btn-${mode}`}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {t(labelKey)}
          </Button>
        );
      })}
    </div>
  );
}
