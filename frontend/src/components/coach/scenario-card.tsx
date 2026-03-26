import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/types/scenario";

interface ScenarioCardProps {
  scenario: Scenario;
  onStart: (scenarioId: string) => void;
}

const difficultyStyles = {
  easy: "bg-blue-100 text-blue-700",
  medium: "bg-orange-100 text-orange-700",
  hard: "bg-red-100 text-red-700",
} as const;

export function ScenarioCard({ scenario, onStart }: ScenarioCardProps) {
  const { t } = useTranslation("coach");

  const hcpInitials = scenario.hcp_profile?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "HC";

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
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
        <h3 className="mt-3 text-lg font-semibold text-gray-900">
          {scenario.hcp_profile?.name ?? scenario.name}
        </h3>
        {scenario.hcp_profile?.specialty && (
          <p className="text-sm text-gray-500">{scenario.hcp_profile.specialty}</p>
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
      <p className="mt-3 line-clamp-2 text-center text-sm text-gray-600">
        {scenario.description}
      </p>

      {/* Full-width Start button */}
      <button
        onClick={() => onStart(scenario.id)}
        className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
      >
        {t("scenarioSelection.startButton", { defaultValue: "Start Training" })}
      </button>
    </div>
  );
}
