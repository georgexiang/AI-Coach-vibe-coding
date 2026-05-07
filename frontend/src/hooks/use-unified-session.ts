/**
 * Unified session state machine hook (D-01, D-04, D-05, D-08).
 *
 * Manages mode transitions between text/voice/digital_human while preserving
 * conversation history. Voice is the default mode (D-05).
 * Mic permission denial auto-degrades to text mode (D-08).
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type {
  UnifiedSessionMode,
  ModeTransition,
  VoiceConnectionState,
} from "@/types/unified-session";

export interface UseUnifiedSessionOptions {
  defaultMode?: UnifiedSessionMode;
  onModeChange?: (from: UnifiedSessionMode, to: UnifiedSessionMode) => void;
}

export interface UnifiedSessionControls {
  mode: UnifiedSessionMode;
  voiceConnectionState: VoiceConnectionState;
  modeTransitions: ModeTransition[];
  switchMode: (to: UnifiedSessionMode) => Promise<void>;
  degradeToText: (reason: string) => void;
  setVoiceConnectionState: (state: VoiceConnectionState) => void;
  isSwitching: boolean;
}

export function useUnifiedSession(
  options: UseUnifiedSessionOptions = {},
): UnifiedSessionControls {
  const { defaultMode = "voice", onModeChange } = options;
  const { t } = useTranslation("session");

  const [mode, setMode] = useState<UnifiedSessionMode>(defaultMode);
  const [voiceConnectionState, setVoiceConnectionState] =
    useState<VoiceConnectionState>("idle");
  const [modeTransitions, setModeTransitions] = useState<ModeTransition[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const switchingRef = useRef(false);

  const recordTransition = useCallback(
    (
      from: UnifiedSessionMode,
      to: UnifiedSessionMode,
      reason: ModeTransition["reason"],
    ) => {
      setModeTransitions((prev) => [
        ...prev,
        { from, to, timestamp: Date.now(), reason },
      ]);
    },
    [],
  );

  const switchMode = useCallback(
    async (to: UnifiedSessionMode) => {
      if (switchingRef.current || to === mode) return;
      switchingRef.current = true;
      setIsSwitching(true);

      const from = mode;

      // If switching TO voice/digital_human, check mic permission (D-08)
      if (to !== "text") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          // Mic denied — degrade to text
          toast.warning(t("micDenied"));
          setMode("text");
          recordTransition(from, "text", "mic_denied");
          switchingRef.current = false;
          setIsSwitching(false);
          return;
        }
      }

      setMode(to);
      recordTransition(from, to, "user_switch");
      onModeChange?.(from, to);

      switchingRef.current = false;
      setIsSwitching(false);
    },
    [mode, onModeChange, recordTransition, t],
  );

  const degradeToText = useCallback(
    (reason: string) => {
      const from = mode;
      setMode("text");
      recordTransition(from, "text", "fallback");
      toast.warning(reason);
    },
    [mode, recordTransition],
  );

  return {
    mode,
    voiceConnectionState,
    modeTransitions,
    switchMode,
    degradeToText,
    setVoiceConnectionState,
    isSwitching,
  };
}
