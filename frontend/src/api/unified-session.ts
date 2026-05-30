import apiClient from "./client";
import type {
  AudioUploadResponse,
  VoiceScoreStatus,
} from "@/types/unified-session";

export async function uploadSessionAudio(
  sessionId: string,
  audioBlob: Blob,
  filename: string = "recording.webm"
): Promise<AudioUploadResponse> {
  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  const { data } = await apiClient.post<AudioUploadResponse>(
    `/sessions/${sessionId}/audio`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function getVoiceScoreStatus(
  sessionId: string
): Promise<VoiceScoreStatus> {
  const { data } = await apiClient.get<VoiceScoreStatus>(
    `/sessions/${sessionId}/voice-score`
  );
  return data;
}
