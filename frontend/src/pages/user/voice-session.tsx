import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { VoiceSession } from "@/components/voice/voice-session";
import { useSession } from "@/hooks/use-session";
import { useScenario } from "@/hooks/use-scenarios";
import type { SessionMode } from "@/types/voice-live";

/**
 * Voice session page component.
 * Full-screen page (no UserLayout wrapper), following conference-session.tsx pattern.
 * Reads session parameters from URL search params.
 */
export default function VoiceSessionPage() {
  const { t } = useTranslation("voice");
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id") ?? "";
  const mode = (searchParams.get("mode") ?? "voice") as SessionMode;

  // Fetch session and scenario data
  const { data: session, isLoading: sessionLoading } = useSession(
    sessionId || undefined,
  );
  const { data: scenario, isLoading: scenarioLoading } = useScenario(
    session?.scenario_id,
  );

  const isLoading = sessionLoading || scenarioLoading;

  if (isLoading || !session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("title")}</p>
        </div>
      </div>
    );
  }

  const hcpName = scenario?.hcp_profile?.name ?? "HCP";
  const systemPrompt = scenario?.description ?? "";
  const language = "zh-CN";

  return (
    <VoiceSession
      sessionId={session.id}
      scenarioId={session.scenario_id}
      mode={mode}
      hcpName={hcpName}
      systemPrompt={systemPrompt}
      language={language}
    />
  );
}
