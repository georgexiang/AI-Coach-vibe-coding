import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import { uploadSessionAudio, getVoiceScoreStatus } from "./unified-session";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("Unified Session API client", () => {
  describe("uploadSessionAudio", () => {
    it("sends POST multipart/form-data to /sessions/:id/audio", async () => {
      mockClient.post.mockResolvedValue({
        data: { audio_url: "audio/sessions/s1/rec.webm", voice_score_status: "pending" },
      });

      const blob = new Blob(["audio"], { type: "audio/webm" });
      const result = await uploadSessionAudio("s1", blob, "recording.webm");

      expect(mockClient.post).toHaveBeenCalledWith(
        "/sessions/s1/audio",
        expect.any(FormData),
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      expect(result.audio_url).toBe("audio/sessions/s1/rec.webm");
      expect(result.voice_score_status).toBe("pending");
    });

    it("uses default filename when not provided", async () => {
      mockClient.post.mockResolvedValue({
        data: { audio_url: "audio/sessions/s1/recording.webm", voice_score_status: "pending" },
      });

      const blob = new Blob(["audio"], { type: "audio/webm" });
      await uploadSessionAudio("s1", blob);

      const formData = mockClient.post.mock.calls[0]![1] as FormData;
      const file = formData.get("file") as File;
      expect(file.name).toBe("recording.webm");
    });

    it("appends blob with correct filename to FormData", async () => {
      mockClient.post.mockResolvedValue({
        data: { audio_url: "url", voice_score_status: "pending" },
      });

      const blob = new Blob(["data"], { type: "audio/webm" });
      await uploadSessionAudio("s1", blob, "custom.webm");

      const formData = mockClient.post.mock.calls[0]![1] as FormData;
      const file = formData.get("file") as File;
      expect(file.name).toBe("custom.webm");
    });
  });

  describe("getVoiceScoreStatus", () => {
    it("calls GET /sessions/:id/voice-score", async () => {
      mockClient.get.mockResolvedValue({
        data: {
          session_id: "s1",
          voice_score_status: "completed",
          audio_url: "audio/sessions/s1/rec.webm",
        },
      });

      const result = await getVoiceScoreStatus("s1");

      expect(mockClient.get).toHaveBeenCalledWith("/sessions/s1/voice-score");
      expect(result.session_id).toBe("s1");
      expect(result.voice_score_status).toBe("completed");
      expect(result.audio_url).toBe("audio/sessions/s1/rec.webm");
    });

    it("returns null audio_url when none available", async () => {
      mockClient.get.mockResolvedValue({
        data: {
          session_id: "s2",
          voice_score_status: "none",
          audio_url: null,
        },
      });

      const result = await getVoiceScoreStatus("s2");
      expect(result.audio_url).toBeNull();
      expect(result.voice_score_status).toBe("none");
    });
  });
});
