import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { VoiceTransport } from "@/types/voice-live";

interface VoiceTransportSelectProps {
  value: VoiceTransport;
  onChange: (transport: VoiceTransport) => void;
  disabled?: boolean;
}

export function VoiceTransportSelect({ value, onChange, disabled }: VoiceTransportSelectProps) {
  const { t } = useTranslation("voice");
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as VoiceTransport)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder={t("transport.label")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="websocket">{t("transport.websocket")}</SelectItem>
        <SelectItem value="webrtc">{t("transport.webrtc")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
