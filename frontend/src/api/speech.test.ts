import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/client", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import apiClient from "@/api/client";
import { transcribeAudio, synthesizeSpeech, getSpeechStatus } from "./speech";

describe("transcribeAudio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends FormData with audio blob and language query param", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { text: "hello", language: "zh-CN" },
    });
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await transcribeAudio(blob, "en-US");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/speech/transcribe?language=en-US",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  });

  it("uses default language zh-CN", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { text: "你好", language: "zh-CN" },
    });
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await transcribeAudio(blob);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/speech/transcribe?language=zh-CN",
      expect.any(FormData),
      expect.any(Object),
    );
  });

  it("returns transcription response", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { text: "hello doctor", language: "en-US" },
    });
    const result = await transcribeAudio(new Blob(["audio"]), "en-US");
    expect(result).toEqual({ text: "hello doctor", language: "en-US" });
  });

  it("propagates API errors", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("401"));
    await expect(transcribeAudio(new Blob([]))).rejects.toThrow("401");
  });
});

describe("synthesizeSpeech", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends JSON body with text, language, voice and responseType blob", async () => {
    const audioBlob = new Blob(["audio data"]);
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: audioBlob });
    await synthesizeSpeech("hello", "en-US", "en-US-JennyNeural");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/speech/synthesize",
      { text: "hello", language: "en-US", voice: "en-US-JennyNeural" },
      { responseType: "blob" },
    );
  });

  it("uses default language zh-CN", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: new Blob([]) });
    await synthesizeSpeech("你好");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/speech/synthesize",
      { text: "你好", language: "zh-CN", voice: undefined },
      { responseType: "blob" },
    );
  });

  it("returns audio blob", async () => {
    const audioBlob = new Blob(["RIFF audio data"]);
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: audioBlob });
    const result = await synthesizeSpeech("test");
    expect(result).toBe(audioBlob);
  });
});

describe("getSpeechStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls GET /speech/status", async () => {
    const status = {
      stt_available: true,
      tts_available: true,
      stt_provider: "azure",
      tts_provider: "azure",
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: status });
    const result = await getSpeechStatus();
    expect(apiClient.get).toHaveBeenCalledWith("/speech/status");
    expect(result).toEqual(status);
  });

  it("propagates errors", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Network Error"));
    await expect(getSpeechStatus()).rejects.toThrow("Network Error");
  });
});
