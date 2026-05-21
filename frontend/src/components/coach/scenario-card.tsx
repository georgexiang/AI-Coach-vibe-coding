import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquareText, Mic, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/types/scenario";

interface ScenarioCardProps {
  scenario: Scenario;
  onStart: (scenarioId: string, mode: string) => void;
  /** Modes the user is allowed to select (filtered by feature flags). Defaults to all modes. */
  availableModes?: string[];
}

const difficultyStyles = {
  easy: "bg-blue-100 text-blue-700",
  medium: "bg-orange-100 text-orange-700",
  hard: "bg-red-100 text-red-700",
} as const;

const TRAINING_MODES = [
  { value: "text", icon: MessageSquareText, labelKey: "scenarioSelection.modeText" },
  { value: "voice_realtime_model", icon: Mic, labelKey: "scenarioSelection.modeVoice" },
  { value: "digital_human_realtime_model", icon: User, labelKey: "scenarioSelection.modeDigitalHuman" },
] as const;

const DEFAULT_MODE = "digital_human_realtime_model";

export function ScenarioCard({ scenario, onStart, availableModes }: ScenarioCardProps) {
  const { t } = useTranslation("coach");

  // Filter modes based on availability
  const filteredModes = availableModes
    ? TRAINING_MODES.filter((m) => availableModes.includes(m.value))
    : TRAINING_MODES;

  // Default to DEFAULT_MODE if available, otherwise first available mode
  const defaultMode = (!availableModes || availableModes.includes(DEFAULT_MODE))
    ? DEFAULT_MODE
    : (filteredModes[0]?.value ?? "text");

  const [selectedMode, setSelectedMode] = useState(defaultMode);

  // If selected mode becomes unavailable (e.g., feature flags changed), auto-select first available
  useEffect(() => {
    if (availableModes && !availableModes.includes(selectedMode)) {
      setSelectedMode(filteredModes[0]?.value ?? "text");
    }
  }, [availableModes, selectedMode, filteredModes]);

  const hcpInitials = scenario.hcp_profile?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "HC";

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      {/* Difficulty badge — upper right */}
      <span
        className={cn(
          "absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold",
          difficultyStyles[scenario.difficulty]
        )}
      >
        {scenario.difficulty}
      </span>

      {/* HCP Avatar */}
      <div className="flex flex-col items-center text-center">
        <Avatar className="size-20 border-2 border-primary/20">
          <AvatarImage src={scenario.hcp_profile?.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-lg text-primary">
            {hcpInitials}
          </AvatarFallback>
        </Avatar>

        {/* HCP Name (bilingual) */}
        <h3 className="mt-3 text-lg font-semibold text-foreground">
          {scenario.hcp_profile?.name ?? scenario.name}
        </h3>
        {scenario.hcp_profile?.specialty && (
          <p className="text-sm text-muted-foreground">{scenario.hcp_profile.specialty}</p>
        )}
      </div>

      {/* Product + traits badges */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {scenario.product && (
          <Badge variant="outline" className="text-xs">
            {scenario.product}
          </Badge>
        )}
        {scenario.hcp_profile?.personality_type && (
          <Badge variant="secondary" className="text-xs">
            {scenario.hcp_profile.personality_type}
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-center text-sm text-muted-foreground">
        {scenario.description}
      </p>

      {/* Mode selector — only show if more than one mode available */}
      {filteredModes.length > 1 && (
        <div className="mt-4">
          <p className="mb-1.5 text-center text-xs font-medium text-muted-foreground">
            {t("scenarioSelection.modeLabel")}
          </p>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {filteredModes.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setSelectedMode(mode.value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t(mode.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-width Start button */}
      <button
        onClick={() => onStart(scenario.id, selectedMode)}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
      >
        {t("scenarioSelection.startButton")}
      </button>
    </div>
  );
}
