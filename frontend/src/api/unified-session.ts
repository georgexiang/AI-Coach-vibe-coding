/**
 * API client for unified session audio and voice scoring.
 */
import apiClient from "./client";
import type {
  AudioUploadResponse,
  VoiceScoreStatus,
} from "@/types/unified-session";

/**
 * Upload session audio recording for voice scoring (D-06, D-10).
 * Called when session ends with recorded audio blob.
 */
export async function uploadSessionAudio(
  sessionId: string,
  audioBlob: Blob,
  filename: string = "recording.webm",
): Promise<AudioUploadResponse> {
  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  const { data } = await apiClient.post<AudioUploadResponse>(
    `/sessions/${sessionId}/audio`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

/**
 * Poll voice score status (D-10: async scoring with delay).
 */
export async function getVoiceScoreStatus(
  sessionId: string,
): Promise<VoiceScoreStatus> {
  const { data } = await apiClient.get<VoiceScoreStatus>(
    `/sessions/${sessionId}/voice-score`,
  );
  return data;
}
