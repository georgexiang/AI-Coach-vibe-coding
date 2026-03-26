import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  getHcpProfiles,
  getHcpProfile,
  createHcpProfile,
  updateHcpProfile,
  deleteHcpProfile,
} from "./hcp-profiles";

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

describe("HCP Profiles API client", () => {
  describe("getHcpProfiles", () => {
    it("calls GET /hcp-profiles with params", async () => {
      const paginated = {
        items: [{ id: "hp-1", name: "Dr. Smith" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getHcpProfiles({ page: 1, page_size: 10 });

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles", {
        params: { page: 1, page_size: 10 },
      });
      expect(result.total).toBe(1);
    });

    it("calls GET /hcp-profiles without params", async () => {
      const paginated = {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getHcpProfiles();

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles", {
        params: undefined,
      });
      expect(result.items).toHaveLength(0);
    });

    it("supports search filter", async () => {
      const paginated = {
        items: [{ id: "hp-1" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      await getHcpProfiles({ search: "Smith" });

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles", {
        params: { search: "Smith" },
      });
    });
  });

  describe("getHcpProfile", () => {
    it("calls GET /hcp-profiles/:id", async () => {
      mockClient.get.mockResolvedValue({
        data: { id: "hp-1", name: "Dr. Smith" },
      });

      const result = await getHcpProfile("hp-1");

      expect(mockClient.get).toHaveBeenCalledWith("/hcp-profiles/hp-1");
      expect(result.name).toBe("Dr. Smith");
    });

    it("propagates 404 for missing profile", async () => {
      mockClient.get.mockRejectedValue(new Error("404"));

      await expect(getHcpProfile("missing")).rejects.toThrow("404");
    });
  });

  describe("createHcpProfile", () => {
    it("calls POST /hcp-profiles with profile data", async () => {
      const profile = { name: "Dr. New", specialty: "Oncology" };
      mockClient.post.mockResolvedValue({
        data: { id: "hp-new", ...profile },
      });

      const result = await createHcpProfile(profile as never);

      expect(mockClient.post).toHaveBeenCalledWith("/hcp-profiles", profile);
      expect(result.id).toBe("hp-new");
    });
  });

  describe("updateHcpProfile", () => {
    it("calls PUT /hcp-profiles/:id with update data", async () => {
      const update = { name: "Dr. Updated" };
      mockClient.put.mockResolvedValue({
        data: { id: "hp-1", name: "Dr. Updated" },
      });

      const result = await updateHcpProfile("hp-1", update as never);

      expect(mockClient.put).toHaveBeenCalledWith("/hcp-profiles/hp-1", update);
      expect(result.name).toBe("Dr. Updated");
    });
  });

  describe("deleteHcpProfile", () => {
    it("calls DELETE /hcp-profiles/:id", async () => {
      mockClient.delete.mockResolvedValue({ status: 204 });

      await deleteHcpProfile("hp-1");

      expect(mockClient.delete).toHaveBeenCalledWith("/hcp-profiles/hp-1");
    });

    it("propagates errors on delete", async () => {
      mockClient.delete.mockRejectedValue(new Error("403 Forbidden"));

      await expect(deleteHcpProfile("hp-1")).rejects.toThrow("403 Forbidden");
    });
  });
});
