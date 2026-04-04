import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VOICE_LIVE_MODEL_OPTIONS = [
  // Pro tier
  { value: "gpt-realtime", i18nKey: "modelGptRealtime", tier: "pro" },
  { value: "gpt-4o", i18nKey: "modelGpt4o", tier: "pro" },
  { value: "gpt-4.1", i18nKey: "modelGpt41", tier: "pro" },
  { value: "gpt-5", i18nKey: "modelGpt5", tier: "pro" },
  { value: "gpt-5-chat", i18nKey: "modelGpt5Chat", tier: "pro" },
  // Basic tier
  { value: "gpt-realtime-mini", i18nKey: "modelGptRealtimeMini", tier: "basic" },
  { value: "gpt-4o-mini", i18nKey: "modelGpt4oMini", tier: "basic" },
  { value: "gpt-4.1-mini", i18nKey: "modelGpt41Mini", tier: "basic" },
  { value: "gpt-5-mini", i18nKey: "modelGpt5Mini", tier: "basic" },
  // Lite tier
  { value: "gpt-5-nano", i18nKey: "modelGpt5Nano", tier: "lite" },
  { value: "phi4-mm-realtime", i18nKey: "modelPhi4MmRealtime", tier: "lite" },
  { value: "phi4-mini", i18nKey: "modelPhi4Mini", tier: "lite" },
] as const;

export { VOICE_LIVE_MODEL_OPTIONS };

const TIER_KEYS: Record<string, string> = {
  pro: "modelTierPro",
  basic: "modelTierStandard",
  lite: "modelTierLite",
};

interface VoiceLiveModelSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function VoiceLiveModelSelect({
  value,
  onValueChange,
  disabled,
}: VoiceLiveModelSelectProps) {
  const { t } = useTranslation("admin");
  const tiers = ["pro", "basic", "lite"];

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {tiers.map((tier) => (
          <SelectGroup key={tier}>
            <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
              {t(`hcp.${TIER_KEYS[tier]}`)}
            </SelectLabel>
            {VOICE_LIVE_MODEL_OPTIONS.filter((m) => m.tier === tier).map(
              (model) => (
                <SelectItem key={model.value} value={model.value}>
                  {t(`hcp.${model.i18nKey}`)}
                </SelectItem>
              ),
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
