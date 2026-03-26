import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  createConferenceSession,
  getConferenceSession,
  updateSubState,
  endConferenceSession,
  getAudienceHcps,
  setAudienceHcps,
} from "./conference";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("Conference API client", () => {
  describe("createConferenceSession", () => {
    it("calls POST /conference/sessions with scenario_id", async () => {
      const session = { id: "cs-1", status: "created", scenarioId: "sc-1" };
      mockClient.post.mockResolvedValue({ data: session });

      const result = await createConferenceSession("sc-1");

      expect(mockClient.post).toHaveBeenCalledWith("/conference/sessions", {
        scenario_id: "sc-1",
      });
      expect(result.id).toBe("cs-1");
    });

    it("propagates creation errors", async () => {
      mockClient.post.mockRejectedValue(new Error("400 Bad Request"));

      await expect(createConferenceSession("bad")).rejects.toThrow(
        "400 Bad Request",
      );
    });
  });

  describe("getConferenceSession", () => {
    it("calls GET /conference/sessions/:id", async () => {
      const session = { id: "cs-1", status: "in_progress" };
      mockClient.get.mockResolvedValue({ data: session });

      const result = await getConferenceSession("cs-1");

      expect(mockClient.get).toHaveBeenCalledWith("/conference/sessions/cs-1");
      expect(result.status).toBe("in_progress");
    });

    it("propagates 404 for missing session", async () => {
      mockClient.get.mockRejectedValue(new Error("404"));

      await expect(getConferenceSession("missing")).rejects.toThrow("404");
    });
  });

  describe("updateSubState", () => {
    it("calls PATCH /conference/sessions/:id/sub-state", async () => {
      mockClient.patch.mockResolvedValue({ data: undefined });

      await updateSubState("cs-1", "qa");

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/conference/sessions/cs-1/sub-state",
        { sub_state: "qa" },
      );
    });
  });

  describe("endConferenceSession", () => {
    it("calls POST /conference/sessions/:id/end", async () => {
      mockClient.post.mockResolvedValue({ data: undefined });

      await endConferenceSession("cs-1");

      expect(mockClient.post).toHaveBeenCalledWith(
        "/conference/sessions/cs-1/end",
      );
    });

    it("propagates errors", async () => {
      mockClient.post.mockRejectedValue(new Error("409"));

      await expect(endConferenceSession("bad")).rejects.toThrow("409");
    });
  });

  describe("getAudienceHcps", () => {
    it("calls GET /conference/scenarios/:id/audience", async () => {
      const hcps = [{ id: "hcp-1", hcpName: "Dr. Smith" }];
      mockClient.get.mockResolvedValue({ data: hcps });

      const result = await getAudienceHcps("sc-1");

      expect(mockClient.get).toHaveBeenCalledWith(
        "/conference/scenarios/sc-1/audience",
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.hcpName).toBe("Dr. Smith");
    });

    it("returns empty array when no audience", async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      const result = await getAudienceHcps("sc-empty");

      expect(result).toHaveLength(0);
    });
  });

  describe("setAudienceHcps", () => {
    it("calls PUT /conference/scenarios/:id/audience with hcps", async () => {
      const input = [{ hcpProfileId: "hp-1" }];
      const output = [{ id: "ah-1", hcpProfileId: "hp-1", hcpName: "Dr. X" }];
      mockClient.put.mockResolvedValue({ data: output });

      const result = await setAudienceHcps("sc-1", input);

      expect(mockClient.put).toHaveBeenCalledWith(
        "/conference/scenarios/sc-1/audience",
        input,
      );
      expect(result).toHaveLength(1);
    });
  });
});
