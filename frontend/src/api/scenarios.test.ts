import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  getScenarios,
  getActiveScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  cloneScenario,
} from "./scenarios";

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

describe("Scenarios API client", () => {
  describe("getScenarios", () => {
    it("calls GET /scenarios with params", async () => {
      const paginated = {
        items: [{ id: "sc-1", name: "Test Scenario" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getScenarios({ page: 1, mode: "f2f" });

      expect(mockClient.get).toHaveBeenCalledWith("/scenarios", {
        params: { page: 1, mode: "f2f" },
      });
      expect(result.total).toBe(1);
    });

    it("calls GET /scenarios without params", async () => {
      const paginated = {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getScenarios();

      expect(mockClient.get).toHaveBeenCalledWith("/scenarios", {
        params: undefined,
      });
      expect(result.items).toHaveLength(0);
    });
  });

  describe("getActiveScenarios", () => {
    it("calls GET /scenarios/active with params", async () => {
      const paginated = {
        items: [{ id: "sc-active" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getActiveScenarios({ page: 1 });

      expect(mockClient.get).toHaveBeenCalledWith("/scenarios/active", {
        params: { page: 1 },
      });
      expect(result.total).toBe(1);
    });

    it("calls GET /scenarios/active without params", async () => {
      mockClient.get.mockResolvedValue({
        data: { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 },
      });

      const result = await getActiveScenarios();

      expect(mockClient.get).toHaveBeenCalledWith("/scenarios/active", {
        params: undefined,
      });
      expect(result.items).toHaveLength(0);
    });
  });

  describe("getScenario", () => {
    it("calls GET /scenarios/:id", async () => {
      mockClient.get.mockResolvedValue({
        data: { id: "sc-1", name: "Scenario 1" },
      });

      const result = await getScenario("sc-1");

      expect(mockClient.get).toHaveBeenCalledWith("/scenarios/sc-1");
      expect(result.name).toBe("Scenario 1");
    });

    it("propagates 404 for missing scenario", async () => {
      mockClient.get.mockRejectedValue(new Error("404"));

      await expect(getScenario("missing")).rejects.toThrow("404");
    });
  });

  describe("createScenario", () => {
    it("calls POST /scenarios with scenario data", async () => {
      const scenario = { name: "New Scenario", mode: "f2f" };
      mockClient.post.mockResolvedValue({
        data: { id: "sc-new", ...scenario },
      });

      const result = await createScenario(scenario as never);

      expect(mockClient.post).toHaveBeenCalledWith("/scenarios", scenario);
      expect(result.id).toBe("sc-new");
    });
  });

  describe("updateScenario", () => {
    it("calls PUT /scenarios/:id with update data", async () => {
      const update = { name: "Updated" };
      mockClient.put.mockResolvedValue({
        data: { id: "sc-1", name: "Updated" },
      });

      const result = await updateScenario("sc-1", update as never);

      expect(mockClient.put).toHaveBeenCalledWith("/scenarios/sc-1", update);
      expect(result.name).toBe("Updated");
    });
  });

  describe("deleteScenario", () => {
    it("calls DELETE /scenarios/:id", async () => {
      mockClient.delete.mockResolvedValue({ status: 204 });

      await deleteScenario("sc-1");

      expect(mockClient.delete).toHaveBeenCalledWith("/scenarios/sc-1");
    });

    it("propagates errors on delete", async () => {
      mockClient.delete.mockRejectedValue(new Error("409 Conflict"));

      await expect(deleteScenario("sc-1")).rejects.toThrow("409 Conflict");
    });
  });

  describe("cloneScenario", () => {
    it("calls POST /scenarios/:id/clone", async () => {
      mockClient.post.mockResolvedValue({
        data: { id: "sc-cloned", name: "Scenario 1 (Copy)" },
      });

      const result = await cloneScenario("sc-1");

      expect(mockClient.post).toHaveBeenCalledWith("/scenarios/sc-1/clone");
      expect(result.id).toBe("sc-cloned");
    });

    it("propagates errors on clone", async () => {
      mockClient.post.mockRejectedValue(new Error("404"));

      await expect(cloneScenario("missing")).rejects.toThrow("404");
    });
  });
});
