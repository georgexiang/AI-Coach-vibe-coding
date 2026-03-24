import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ScrollArea,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { KeyMessages } from "./key-messages";
import type { Scenario } from "@/types/scenario";
import type { KeyMessageStatus } from "@/types/session";

interface ScenarioPanelProps {
  scenario: Scenario;
  keyMessagesStatus: KeyMessageStatus[];
  isCollapsed: boolean;
  onToggle: () => void;
}

export function ScenarioPanel({
  scenario,
  keyMessagesStatus,
  isCollapsed,
  onToggle,
}: ScenarioPanelProps) {
  const { t } = useTranslation("coach");

  const hcpInitials = scenario.hcp_profile?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "HC";

  if (isCollapsed) {
    return (
      <div className="flex w-12 flex-col items-center border-r border-slate-200 bg-slate-50 pt-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={t("session.trainingPanel")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const weights = scenario.scoring_weights;
  const weightEntries = [
    { label: "Key Message", value: weights.key_message_delivery },
    { label: "Objection Handling", value: weights.objection_handling },
    { label: "Communication", value: weights.communication_skills },
    { label: "Product Knowledge", value: weights.product_knowledge },
    { label: "Scientific", value: weights.scientific_information },
  ];

  return (
    <div className="flex w-[280px] flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h2 className="text-sm font-semibold">{t("session.trainingPanel")}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-expanded={true}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto p-4">
        {/* Scenario Briefing */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("session.scenarioBriefing")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Product</span>
              <span className="font-medium">{scenario.product}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Area</span>
              <span className="font-medium">{scenario.therapeutic_area}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Difficulty</span>
              <Badge variant="secondary" className="text-xs">
                {scenario.difficulty}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* HCP Profile */}
        {scenario.hcp_profile && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("session.hcpProfile")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-[60px] w-[60px]">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {hcpInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{scenario.hcp_profile.name}</p>
                  <p className="text-sm text-slate-600">
                    {scenario.hcp_profile.specialty}
                  </p>
                  <p className="text-sm text-slate-600">
                    {scenario.hcp_profile.personality_type}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Messages */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("session.keyMessages")}</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyMessages messages={keyMessagesStatus} />
          </CardContent>
        </Card>

        {/* Scoring Criteria */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("session.scoringCriteria")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {weightEntries.map((entry) => (
              <div key={entry.label} className="flex justify-between text-sm">
                <span className="text-slate-600">{entry.label}</span>
                <span className="font-semibold">{entry.value}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
