import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import { getSessionReport, getSessionSuggestions } from "./reports";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("Reports API client", () => {
  describe("getSessionReport", () => {
    it("calls GET /scoring/sessions/:id/report", async () => {
      const report = {
        session_id: "sess-1",
        overall_score: 85,
        passed: true,
        feedback_summary: "Good",
        dimensions: [],
        strengths: [],
        weaknesses: [],
        improvements: [],
      };
      mockClient.get.mockResolvedValue({ data: report });

      const result = await getSessionReport("sess-1");

      expect(mockClient.get).toHaveBeenCalledWith(
        "/scoring/sessions/sess-1/report",
      );
      expect(result.overall_score).toBe(85);
      expect(result.passed).toBe(true);
    });

    it("propagates 404 for missing session report", async () => {
      mockClient.get.mockRejectedValue(new Error("404"));

      await expect(getSessionReport("missing")).rejects.toThrow("404");
    });
  });

  describe("getSessionSuggestions", () => {
    it("calls GET /scoring/sessions/:id/suggestions", async () => {
      const suggestions = [
        { id: "s1", dimension: "Knowledge", suggestion: "Study more", priority: "high" },
        { id: "s2", dimension: "Communication", suggestion: "Be clearer", priority: "medium" },
      ];
      mockClient.get.mockResolvedValue({ data: suggestions });

      const result = await getSessionSuggestions("sess-1");

      expect(mockClient.get).toHaveBeenCalledWith(
        "/scoring/sessions/sess-1/suggestions",
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.dimension).toBe("Knowledge");
    });

    it("returns empty array when no suggestions", async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      const result = await getSessionSuggestions("sess-empty");

      expect(result).toHaveLength(0);
    });
  });
});
