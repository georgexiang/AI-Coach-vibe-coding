import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  fetchVoiceLiveToken,
  fetchVoiceLiveStatus,
  persistTranscriptMessage,
} from "./voice-live";

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

describe("Voice Live API client", () => {
  describe("fetchVoiceLiveToken", () => {
    it("calls POST /voice-live/token and returns token data", async () => {
      const tokenData = {
        endpoint: "wss://eastus2.api.cognitive.microsoft.com",
        token: "test-token-123",
        region: "eastus2",
        model: "gpt-4o-realtime",
        avatar_enabled: false,
        avatar_character: "lisa",
        voice_name: "en-US-JennyNeural",
      };
      mockClient.post.mockResolvedValue({ data: tokenData });

      const result = await fetchVoiceLiveToken();

      expect(mockClient.post).toHaveBeenCalledWith("/voice-live/token", null, { params: {} });
      expect(result).toEqual(tokenData);
      expect(result.endpoint).toBe("wss://eastus2.api.cognitive.microsoft.com");
      expect(result.avatar_enabled).toBe(false);
    });

    it("propagates errors from apiClient", async () => {
      mockClient.post.mockRejectedValue(new Error("401 Unauthorized"));

      await expect(fetchVoiceLiveToken()).rejects.toThrow("401 Unauthorized");
    });
  });

  describe("fetchVoiceLiveStatus", () => {
    it("calls GET /voice-live/status and returns status with availability flags", async () => {
      const statusData = {
        voice_live_available: true,
        avatar_available: false,
        voice_name: "en-US-JennyNeural",
        avatar_character: "lisa",
      };
      mockClient.get.mockResolvedValue({ data: statusData });

      const result = await fetchVoiceLiveStatus();

      expect(mockClient.get).toHaveBeenCalledWith("/voice-live/status");
      expect(result).toEqual(statusData);
      expect(result.voice_live_available).toBe(true);
      expect(result.avatar_available).toBe(false);
    });

    it("propagates errors from apiClient", async () => {
      mockClient.get.mockRejectedValue(new Error("500 Internal Server Error"));

      await expect(fetchVoiceLiveStatus()).rejects.toThrow(
        "500 Internal Server Error",
      );
    });
  });

  describe("persistTranscriptMessage", () => {
    it("calls POST /sessions/:id/messages with correct payload", async () => {
      mockClient.post.mockResolvedValue({ data: undefined });

      await persistTranscriptMessage("sess-123", "user", "Hello doctor");

      expect(mockClient.post).toHaveBeenCalledWith(
        "/sessions/sess-123/messages",
        {
          message: "Hello doctor",
          role: "user",
          source: "voice_transcript",
        },
      );
    });

    it("propagates errors from apiClient", async () => {
      mockClient.post.mockRejectedValue(new Error("404 Not Found"));

      await expect(
        persistTranscriptMessage("bad-id", "assistant", "Response"),
      ).rejects.toThrow("404 Not Found");
    });
  });
});
