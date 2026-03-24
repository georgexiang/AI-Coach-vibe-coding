import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ScoringWeightsProps {
  weights: {
    key_message: number;
    objection_handling: number;
    communication: number;
    product_knowledge: number;
    scientific_info: number;
  };
  onChange: (weights: ScoringWeightsProps["weights"]) => void;
}

type WeightKey = keyof ScoringWeightsProps["weights"];

const WEIGHT_KEYS: WeightKey[] = [
  "key_message",
  "objection_handling",
  "communication",
  "product_knowledge",
  "scientific_info",
];

const I18N_KEYS: Record<WeightKey, string> = {
  key_message: "scenarios.keyMessageDelivery",
  objection_handling: "scenarios.objectionHandling",
  communication: "scenarios.communicationSkills",
  product_knowledge: "scenarios.productKnowledge",
  scientific_info: "scenarios.scientificInfo",
};

function adjustWeights(
  current: ScoringWeightsProps["weights"],
  changedKey: WeightKey,
  newValue: number,
): ScoringWeightsProps["weights"] {
  const oldValue = current[changedKey];
  const diff = newValue - oldValue;

  if (diff === 0) return current;

  const otherKeys = WEIGHT_KEYS.filter((k) => k !== changedKey);
  const otherSum = otherKeys.reduce((sum, k) => sum + current[k], 0);

  const result = { ...current, [changedKey]: newValue };

  if (otherSum === 0) {
    // Distribute equally among others
    const each = Math.floor(-diff / otherKeys.length);
    let remaining = -diff - each * otherKeys.length;
    for (const key of otherKeys) {
      result[key] = each + (remaining > 0 ? 1 : 0);
      if (remaining > 0) remaining--;
    }
  } else {
    // Distribute proportionally
    let distributed = 0;
    for (let i = 0; i < otherKeys.length; i++) {
      const key = otherKeys[i]!;
      if (i === otherKeys.length - 1) {
        // Last one gets remainder to ensure sum === 100
        result[key] = 100 - newValue - distributed;
      } else {
        const proportion = current[key] / otherSum;
        const adjustment = Math.round(-diff * proportion);
        const adjusted = Math.max(0, current[key] + adjustment);
        result[key] = adjusted;
        distributed += adjusted;
      }
    }
  }

  // Fix rounding: ensure sum === 100
  const total = WEIGHT_KEYS.reduce((sum, k) => sum + result[k], 0);
  if (total !== 100) {
    const lastOther = otherKeys[otherKeys.length - 1]!;
    result[lastOther] = Math.max(0, result[lastOther] + (100 - total));
  }

  // Ensure no negatives
  for (const key of WEIGHT_KEYS) {
    if (result[key] < 0) result[key] = 0;
  }

  return result;
}

export function ScoringWeights({ weights, onChange }: ScoringWeightsProps) {
  const { t } = useTranslation("admin");

  const handleSliderChange = (key: WeightKey, values: number[]) => {
    const newValue = values[0] ?? 0;
    const adjusted = adjustWeights(weights, key, newValue);
    onChange(adjusted);
  };

  const total = WEIGHT_KEYS.reduce((sum, k) => sum + weights[k], 0);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span>{t("scenarios.scoringWeights")}</span>
          <span className="text-sm font-normal text-muted-foreground">
            Total: {total}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {WEIGHT_KEYS.map((key) => (
          <div key={key} className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t(I18N_KEYS[key])}</Label>
              <span className="text-sm font-semibold">{weights[key]}%</span>
            </div>
            <Slider
              value={[weights[key]]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v: number[]) => handleSliderChange(key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { adjustWeights };
