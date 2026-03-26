import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  getRubrics,
  createRubric,
  updateRubric,
  deleteRubric,
} from "./rubrics";

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
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("Rubrics API client", () => {
  describe("getRubrics", () => {
    it("calls GET /rubrics with params", async () => {
      const rubrics = [
        { id: "r-1", name: "Default Rubric", scenario_type: "f2f" },
      ];
      mockClient.get.mockResolvedValue({ data: rubrics });

      const result = await getRubrics({ scenario_type: "f2f" });

      expect(mockClient.get).toHaveBeenCalledWith("/rubrics", {
        params: { scenario_type: "f2f" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("Default Rubric");
    });

    it("calls GET /rubrics without params", async () => {
      mockClient.get.mockResolvedValue({ data: [] });

      const result = await getRubrics();

      expect(mockClient.get).toHaveBeenCalledWith("/rubrics", {
        params: undefined,
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("createRubric", () => {
    it("calls POST /rubrics with payload", async () => {
      const payload = {
        name: "New Rubric",
        dimensions: [{ name: "Knowledge", weight: 1, criteria: [], max_score: 100 }],
      };
      mockClient.post.mockResolvedValue({
        data: { id: "r-new", ...payload },
      });

      const result = await createRubric(payload);

      expect(mockClient.post).toHaveBeenCalledWith(
        "/rubrics",
        payload,
      );
      expect(result.id).toBe("r-new");
    });

    it("propagates creation errors", async () => {
      mockClient.post.mockRejectedValue(new Error("422 Validation Error"));

      await expect(
        createRubric({ name: "", dimensions: [] }),
      ).rejects.toThrow("422 Validation Error");
    });
  });

  describe("updateRubric", () => {
    it("calls PUT /rubrics/:id with payload", async () => {
      const payload = { name: "Updated Rubric" };
      mockClient.put.mockResolvedValue({
        data: { id: "r-1", name: "Updated Rubric" },
      });

      const result = await updateRubric("r-1", payload);

      expect(mockClient.put).toHaveBeenCalledWith(
        "/rubrics/r-1",
        payload,
      );
      expect(result.name).toBe("Updated Rubric");
    });
  });

  describe("deleteRubric", () => {
    it("calls DELETE /rubrics/:id", async () => {
      mockClient.delete.mockResolvedValue({ status: 204 });

      await deleteRubric("r-1");

      expect(mockClient.delete).toHaveBeenCalledWith("/rubrics/r-1");
    });

    it("propagates errors on delete", async () => {
      mockClient.delete.mockRejectedValue(new Error("404 Not Found"));

      await expect(deleteRubric("missing")).rejects.toThrow("404 Not Found");
    });
  });
});
