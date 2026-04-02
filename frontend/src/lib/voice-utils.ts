import type { VoiceLiveToken, SessionMode } from "@/types/voice-live";

/**
 * Auto-resolve the best available session mode from token broker response (D-10).
 * Priority: Digital Human Realtime Agent > Digital Human Realtime Model > Voice Realtime Agent > Voice Realtime Model.
 */
export function resolveMode(tokenData: VoiceLiveToken): SessionMode {
  if (tokenData.avatar_enabled && tokenData.agent_id) {
    return "digital_human_realtime_agent";
  }
  if (tokenData.avatar_enabled) {
    return "digital_human_realtime_model";
  }
  if (tokenData.agent_id) {
    return "voice_realtime_agent";
  }
  return "voice_realtime_model";
}
