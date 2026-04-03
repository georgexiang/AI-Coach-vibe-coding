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
  { value: "gpt-realtime", label: "GPT Realtime", tier: "pro" },
  { value: "gpt-4o", label: "GPT-4o", tier: "pro" },
  { value: "gpt-4.1", label: "GPT-4.1", tier: "pro" },
  { value: "gpt-5", label: "GPT-5", tier: "pro" },
  { value: "gpt-5-chat", label: "GPT-5 Chat", tier: "pro" },
  // Basic tier
  { value: "gpt-realtime-mini", label: "GPT Realtime Mini", tier: "basic" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", tier: "basic" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", tier: "basic" },
  { value: "gpt-5-mini", label: "GPT-5 Mini", tier: "basic" },
  // Lite tier
  { value: "gpt-5-nano", label: "GPT-5 Nano", tier: "lite" },
  { value: "phi4-mm-realtime", label: "Phi4-MM Realtime", tier: "lite" },
  { value: "phi4-mini", label: "Phi4 Mini", tier: "lite" },
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
                  {model.label}
                </SelectItem>
              ),
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
