import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { VoiceSession } from "@/components/voice/voice-session";
import { useSession } from "@/hooks/use-session";
import { useScenario } from "@/hooks/use-scenarios";

/**
 * Voice session page component.
 * Full-screen page (no UserLayout wrapper), following conference-session.tsx pattern.
 * Reads session parameters from URL search params.
 * Mode is auto-resolved from token broker (D-10) -- no manual mode selection.
 */
export default function VoiceSessionPage() {
  const { t } = useTranslation("voice");
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id") ?? "";

  // Fetch session and scenario data
  const { data: session, isLoading: sessionLoading } = useSession(
    sessionId || undefined,
  );
  const { data: scenario } = useScenario(session?.scenario_id);

  // Only block on session loading -- scenario is optional (graceful degradation)
  if (sessionLoading || !session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("title")}</p>
        </div>
      </div>
    );
  }

  const hcpProfileId = scenario?.hcp_profile_id ?? "";
  const hcpName = scenario?.hcp_profile?.name ?? "HCP";
  const systemPrompt = scenario?.description ?? "";
  const language = "zh-CN";

  return (
    <VoiceSession
      sessionId={session.id}
      scenarioId={session.scenario_id}
      hcpProfileId={hcpProfileId}
      hcpName={hcpName}
      systemPrompt={systemPrompt}
      language={language}
    />
  );
}
