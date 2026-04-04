import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/types/voice-live";

interface FloatingTranscriptProps {
  lastTranscript: TranscriptSegment | null;
  hcpName: string;
  className?: string;
}

/**
 * Full-screen overlay transcript.
 * Shows the last transcript segment as a semi-transparent overlay at the bottom.
 * Hidden when no transcript is available.
 */
export function FloatingTranscript({
  lastTranscript,
  hcpName,
  className,
}: FloatingTranscriptProps) {
  const { t } = useTranslation("voice");

  if (!lastTranscript) return null;

  const isUser = lastTranscript.role === "user";
  const speakerLabel = isUser
    ? t("transcript.user")
    : t("transcript.hcp", { name: hcpName });

  return (
    <div
      className={cn(
        "flex h-20 items-center rounded-t-lg px-4",
        className,
      )}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
    >
      <div className="w-full">
        <p
          className={cn(
            "text-sm font-medium",
            isUser ? "text-primary" : "text-voice-speaking",
          )}
        >
          {speakerLabel}
        </p>
        <p className="truncate text-base text-white">
          {lastTranscript.content}
        </p>
      </div>
    </div>
  );
}
