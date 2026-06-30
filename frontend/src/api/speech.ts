import apiClient from "./client";
import axios from "axios";

export interface TranscribeResponse {
  text: string;
  language: string;
}

export interface SpeechStatus {
  stt_available: boolean;
  tts_available: boolean;
  stt_provider: string;
  tts_provider: string;
}

/**
 * Transcribe audio blob to text via backend STT.
 * Sends audio as multipart/form-data.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: string = "zh-CN",
): Promise<TranscribeResponse> {
  const formData = new FormData();
  const extension = audioBlob.type.includes("wav") ? "wav" : "webm";
  formData.append("audio", audioBlob, `recording.${extension}`);
  try {
    const { data } = await apiClient.post<TranscribeResponse>(
      `/speech/transcribe?language=${encodeURIComponent(language)}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { code?: string; message?: string } | undefined;
      if (data?.code === "STT_TRANSCRIPTION_FAILED") {
        throw new Error("语音转写失败，请重试或使用文字输入。");
      }
      throw new Error(data?.message ?? "语音转写失败，请重试或使用文字输入。");
    }
    throw error;
  }
}

/**
 * Synthesize text to speech audio via backend TTS.
 * Returns audio blob for playback.
 */
export async function synthesizeSpeech(
  text: string,
  language: string = "zh-CN",
  voice?: string,
): Promise<Blob> {
  const { data } = await apiClient.post(
    "/speech/synthesize",
    { text, language, voice },
    { responseType: "blob" },
  );
  return data as Blob;
}

/**
 * Get STT/TTS service availability.
 */
export async function getSpeechStatus(): Promise<SpeechStatus> {
  const { data } = await apiClient.get<SpeechStatus>("/speech/status");
  return data;
}
