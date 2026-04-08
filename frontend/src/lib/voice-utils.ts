import type { VoiceLiveToken, SessionMode } from "@/types/voice-live";

/**
 * Encode Float32Array PCM audio to base64-encoded Int16 PCM.
 * Clips values to [-1, 1] range before conversion.
 */
export function encodePcmToBase64(audioData: Float32Array): string {
  const int16 = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i] ?? 0));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

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
