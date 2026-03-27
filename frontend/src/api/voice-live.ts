import apiClient from "@/api/client";
import type { VoiceLiveToken, VoiceLiveConfigStatus } from "@/types/voice-live";

export async function fetchVoiceLiveToken(): Promise<VoiceLiveToken> {
  const response = await apiClient.post<VoiceLiveToken>("/voice-live/token");
  return response.data;
}

export async function fetchVoiceLiveStatus(): Promise<VoiceLiveConfigStatus> {
  const response = await apiClient.get<VoiceLiveConfigStatus>("/voice-live/status");
  return response.data;
}

export async function persistTranscriptMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await apiClient.post(`/sessions/${sessionId}/messages`, {
    message: content,
    role,
    source: "voice_transcript",
  });
}
