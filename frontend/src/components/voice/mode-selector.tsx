import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Mic, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui";
import type { SessionMode } from "@/types/voice-live";

/** Communication type (Level 1). */
type CommunicationType = "text" | "voice" | "digital_human";

/** Engine type (Level 2). */
type EngineType = "pipeline" | "realtime_model" | "realtime_agent";

interface ModeSelectorProps {
  value: SessionMode;
  onChange: (mode: SessionMode) => void;
  voiceLiveAvailable: boolean;
  avatarAvailable: boolean;
  pipelineAvailable: boolean;
  agentAvailable: boolean;
  disabled?: boolean;
}

/** Map (communicationType, engine) -> SessionMode */
const MODE_MAP: Record<CommunicationType, Record<EngineType, SessionMode | null>> = {
  text: {
    pipeline: null,
    realtime_model: null,
    realtime_agent: null,
  },
  voice: {
    pipeline: "voice_pipeline",
    realtime_model: "voice_realtime_model",
    realtime_agent: "voice_realtime_agent",
  },
  digital_human: {
    pipeline: "digital_human_pipeline",
    realtime_model: "digital_human_realtime_model",
    realtime_agent: "digital_human_realtime_agent",
  },
};

/** Parse SessionMode back into communicationType and engine. */
function parseMode(mode: SessionMode): { commType: CommunicationType; engine: EngineType } {
  if (mode === "text") {
    return { commType: "text", engine: "pipeline" };
  }
  if (mode.startsWith("digital_human_")) {
    const enginePart = mode.replace("digital_human_", "") as EngineType;
    return { commType: "digital_human", engine: enginePart };
  }
  if (mode.startsWith("voice_")) {
    const enginePart = mode.replace("voice_", "") as EngineType;
    return { commType: "voice", engine: enginePart };
  }
  return { commType: "text", engine: "pipeline" };
}

interface CommTypeOption {
  type: CommunicationType;
  icon: typeof MessageSquare;
  labelKey: string;
  unavailableKey: string;
}

const COMM_TYPE_OPTIONS: CommTypeOption[] = [
  {
    type: "text",
    icon: MessageSquare,
    labelKey: "commType.text",
    unavailableKey: "",
  },
  {
    type: "voice",
    icon: Mic,
    labelKey: "commType.voice",
    unavailableKey: "notConfigured",
  },
  {
    type: "digital_human",
    icon: User,
    labelKey: "commType.digital_human",
    unavailableKey: "avatarNotConfigured",
  },
];

interface EngineOption {
  engine: EngineType;
  labelKey: string;
  unavailableKey: string;
}

const ENGINE_OPTIONS: EngineOption[] = [
  {
    engine: "pipeline",
    labelKey: "engine.pipeline",
    unavailableKey: "pipelineNotConfigured",
  },
  {
    engine: "realtime_model",
    labelKey: "engine.realtime_model",
    unavailableKey: "notConfigured",
  },
  {
    engine: "realtime_agent",
    labelKey: "engine.realtime_agent",
    unavailableKey: "agentNotConfigured",
  },
];

/**
 * Two-level mode selector for 7 interaction modes.
 * Level 1: Communication type (Text / Voice / Digital Human)
 * Level 2: Engine (Pipeline / Realtime / Agent) — shown when Voice or Digital Human is selected
 */
export function ModeSelector({
  value,
  onChange,
  voiceLiveAvailable,
  avatarAvailable,
  pipelineAvailable,
  agentAvailable,
  disabled = false,
}: ModeSelectorProps) {
  const { t } = useTranslation("voice");

  const { commType, engine } = useMemo(() => parseMode(value), [value]);

  /** Check if a communication type is available. */
  const isCommTypeAvailable = (type: CommunicationType): boolean => {
    if (type === "text") return true;
    if (type === "voice") return voiceLiveAvailable || pipelineAvailable;
    if (type === "digital_human") return avatarAvailable;
    return false;
  };

  /** Check if an engine is available. */
  const isEngineAvailable = (eng: EngineType): boolean => {
    if (eng === "pipeline") return pipelineAvailable;
    if (eng === "realtime_model") return voiceLiveAvailable;
    if (eng === "realtime_agent") return agentAvailable;
    return false;
  };

  /** Handle communication type change (Level 1). */
  const handleCommTypeChange = (newCommType: CommunicationType) => {
    if (newCommType === "text") {
      onChange("text");
      return;
    }
    // Find the best available engine for this comm type
    const currentEngineAvailable = isEngineAvailable(engine);
    const selectedEngine = currentEngineAvailable ? engine : findFirstAvailableEngine();
    const commTypeMap = MODE_MAP[newCommType];
    const newMode = commTypeMap[selectedEngine];
    if (newMode) {
      onChange(newMode);
    }
  };

  /** Handle engine change (Level 2). */
  const handleEngineChange = (newEngine: EngineType) => {
    const commTypeMap = MODE_MAP[commType];
    const newMode = commTypeMap[newEngine];
    if (newMode) {
      onChange(newMode);
    }
  };

  /** Find first available engine. */
  const findFirstAvailableEngine = (): EngineType => {
    for (const opt of ENGINE_OPTIONS) {
      if (isEngineAvailable(opt.engine)) return opt.engine;
    }
    return "pipeline"; // fallback
  };

  const showEngineRow = commType !== "text";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Level 1: Communication Type */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs text-muted-foreground">{t("modeSelector")}</p>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={t("modeSelector")}>
          {COMM_TYPE_OPTIONS.map((option) => {
            const available = isCommTypeAvailable(option.type);
            const isActive = commType === option.type;
            const Icon = option.icon;
            const isDisabled = disabled || !available;

            const button = (
              <button
                key={option.type}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={t(option.labelKey)}
                disabled={isDisabled}
                onClick={() => {
                  if (available && !disabled) {
                    handleCommTypeChange(option.type);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  isDisabled && "opacity-50 cursor-not-allowed",
                )}
                data-testid={`mode-${option.type}`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(option.labelKey)}</span>
              </button>
            );

            if (!available && option.unavailableKey) {
              return (
                <Tooltip key={option.type}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>{t(option.unavailableKey)}</TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </div>
      </div>

      {/* Level 2: Engine (hidden for text mode) */}
      {showEngineRow && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted-foreground">{t("engineSelector")}</p>
          <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label={t("engineSelector")}>
            {ENGINE_OPTIONS.map((option) => {
              const available = isEngineAvailable(option.engine);
              const isActive = engine === option.engine;
              const isDisabled = disabled || !available;

              const button = (
                <button
                  key={option.engine}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={t(option.labelKey)}
                  disabled={isDisabled}
                  onClick={() => {
                    if (available && !disabled) {
                      handleEngineChange(option.engine);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    isDisabled && "opacity-50 cursor-not-allowed",
                  )}
                  data-testid={`engine-${option.engine}`}
                >
                  <span>{t(option.labelKey)}</span>
                </button>
              );

              if (!available && option.unavailableKey) {
                return (
                  <Tooltip key={option.engine}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent>{t(option.unavailableKey)}</TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
