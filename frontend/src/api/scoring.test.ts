import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import { triggerScoring, getSessionScore } from "./scoring";

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
  post: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("Scoring API client", () => {
  it("triggerScoring calls POST /scoring/sessions/:id/score", async () => {
    const mockScore = {
      session_id: "sess-1",
      overall_score: 85,
      passed: true,
      feedback_summary: "Good",
      details: [],
    };
    mockClient.post.mockResolvedValue({ data: mockScore });

    const result = await triggerScoring("sess-1");

    expect(mockClient.post).toHaveBeenCalledWith(
      "/scoring/sessions/sess-1/score",
    );
    expect(result.session_id).toBe("sess-1");
    expect(result.overall_score).toBe(85);
    expect(result.passed).toBe(true);
  });

  it("triggerScoring propagates errors", async () => {
    mockClient.post.mockRejectedValue(new Error("409 Conflict"));

    await expect(triggerScoring("sess-1")).rejects.toThrow("409 Conflict");
  });

  it("getSessionScore calls GET /scoring/sessions/:id/score", async () => {
    const mockScore = {
      session_id: "sess-2",
      overall_score: 72,
      passed: true,
      feedback_summary: "Needs work",
      details: [
        {
          dimension: "Communication",
          score: 75,
          weight: 20,
          strengths: [],
          weaknesses: [],
          suggestions: [],
        },
      ],
    };
    mockClient.get.mockResolvedValue({ data: mockScore });

    const result = await getSessionScore("sess-2");

    expect(mockClient.get).toHaveBeenCalledWith(
      "/scoring/sessions/sess-2/score",
    );
    expect(result.session_id).toBe("sess-2");
    expect(result.details).toHaveLength(1);
    expect(result.details[0]?.dimension).toBe("Communication");
  });

  it("getSessionScore propagates 404 errors", async () => {
    mockClient.get.mockRejectedValue(new Error("404 Not Found"));

    await expect(getSessionScore("missing-id")).rejects.toThrow(
      "404 Not Found",
    );
  });

  it("triggerScoring uses correct URL format with session id", async () => {
    mockClient.post.mockResolvedValue({
      data: { session_id: "abc-123", overall_score: 80, passed: true },
    });

    await triggerScoring("abc-123");

    expect(mockClient.post).toHaveBeenCalledWith(
      "/scoring/sessions/abc-123/score",
    );
  });
});
