import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERSONALITY_TYPES = [
  "friendly",
  "skeptical",
  "busy",
  "analytical",
  "cautious",
] as const;

interface PersonalitySlidersProps {
  personalityType: string;
  emotionalState: number;
  communicationStyle: number;
  onPersonalityTypeChange: (value: string) => void;
  onEmotionalStateChange: (value: number) => void;
  onCommunicationStyleChange: (value: number) => void;
}

export function PersonalitySliders({
  personalityType,
  emotionalState,
  communicationStyle,
  onPersonalityTypeChange,
  onEmotionalStateChange,
  onCommunicationStyleChange,
}: PersonalitySlidersProps) {
  const { t } = useTranslation("admin");

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t("hcp.personality")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>{t("hcp.personalityType")}</Label>
          <Select value={personalityType} onValueChange={onPersonalityTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONALITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>{t("hcp.emotionalState")}</Label>
            <span className="text-sm text-muted-foreground">{emotionalState}</span>
          </div>
          <Slider
            value={[emotionalState]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v: number[]) => onEmotionalStateChange(v[0] ?? 0)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Calm/Neutral</span>
            <span>Resistant/Hostile</span>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>{t("hcp.communicationStyle")}</Label>
            <span className="text-sm text-muted-foreground">{communicationStyle}</span>
          </div>
          <Slider
            value={[communicationStyle]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v: number[]) => onCommunicationStyleChange(v[0] ?? 0)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Very Direct</span>
            <span>Very Indirect</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
