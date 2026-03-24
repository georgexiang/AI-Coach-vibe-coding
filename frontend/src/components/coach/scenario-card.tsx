import { useTranslation } from "react-i18next";
import { PlayCircle, Clock, Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui";
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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Card header */}
      <div className="flex h-48 items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
        <PlayCircle className="h-16 w-16 text-white opacity-80" />
      </div>

      {/* Card body */}
      <div className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          {scenario.name}
        </h3>
        <p className="mb-4 text-sm text-gray-600">{scenario.description}</p>

        {/* Metadata row */}
        <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {scenario.estimated_duration} min
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            {scenario.difficulty}
          </span>
        </div>

        {/* HCP info */}
        {scenario.hcp_profile && (
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-sm text-blue-700">
                {hcpInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {scenario.hcp_profile.name}
              </p>
              <p className="text-sm text-gray-600">
                {scenario.hcp_profile.specialty}
              </p>
            </div>
          </div>
        )}

        {/* Difficulty badge + Start button */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold",
              difficultyStyles[scenario.difficulty]
            )}
          >
            {scenario.difficulty}
          </span>
          <button
            onClick={() => onStart(scenario.id)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {t("scenarioSelection.startButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
