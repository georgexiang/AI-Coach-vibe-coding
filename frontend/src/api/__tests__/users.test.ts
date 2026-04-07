import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "../client";
import { getUsers, updateUser, deleteUser } from "../users";

vi.mock("../client", () => ({
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
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => vi.clearAllMocks());

describe("Users API client", () => {
  describe("getUsers", () => {
    it("calls GET /users with pagination params", async () => {
      const paginated = {
        items: [
          {
            id: "u-1",
            username: "jdoe",
            email: "jdoe@example.com",
            full_name: "John Doe",
            role: "mr",
            is_active: true,
            preferred_language: "en",
            business_unit: "Oncology",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getUsers({ page: 1, page_size: 20 });

      expect(mockClient.get).toHaveBeenCalledWith("/users", {
        params: { page: 1, page_size: 20 },
      });
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.username).toBe("jdoe");
    });

    it("calls GET /users without params", async () => {
      const paginated = {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      const result = await getUsers();

      expect(mockClient.get).toHaveBeenCalledWith("/users", {
        params: undefined,
      });
      expect(result.items).toHaveLength(0);
    });

    it("supports search filter", async () => {
      const paginated = {
        items: [{ id: "u-1" }],
        total: 1,
        page: 1,
        page_size: 20,
        total_pages: 1,
      };
      mockClient.get.mockResolvedValue({ data: paginated });

      await getUsers({ search: "doe" });

      expect(mockClient.get).toHaveBeenCalledWith("/users", {
        params: { search: "doe" },
      });
    });

    it("supports role filter", async () => {
      mockClient.get.mockResolvedValue({
        data: { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 },
      });

      await getUsers({ role: "admin" });

      expect(mockClient.get).toHaveBeenCalledWith("/users", {
        params: { role: "admin" },
      });
    });

    it("supports is_active filter", async () => {
      mockClient.get.mockResolvedValue({
        data: { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 },
      });

      await getUsers({ is_active: true });

      expect(mockClient.get).toHaveBeenCalledWith("/users", {
        params: { is_active: true },
      });
    });

    it("propagates errors from apiClient", async () => {
      mockClient.get.mockRejectedValue(new Error("500 Internal Server Error"));

      await expect(getUsers()).rejects.toThrow("500 Internal Server Error");
    });
  });

  describe("updateUser", () => {
    it("calls PATCH /users/:id with update data", async () => {
      const updated = {
        id: "u-1",
        username: "jdoe",
        email: "jdoe@example.com",
        full_name: "John Updated",
        role: "admin",
        is_active: true,
        preferred_language: "en",
        business_unit: "Oncology",
        created_at: "2026-01-01T00:00:00Z",
      };
      mockClient.patch.mockResolvedValue({ data: updated });

      const result = await updateUser("u-1", {
        full_name: "John Updated",
        role: "admin",
      });

      expect(mockClient.patch).toHaveBeenCalledWith("/users/u-1", {
        full_name: "John Updated",
        role: "admin",
      });
      expect(result.full_name).toBe("John Updated");
      expect(result.role).toBe("admin");
    });

    it("propagates errors on update", async () => {
      mockClient.patch.mockRejectedValue(new Error("404 Not Found"));

      await expect(
        updateUser("missing", { full_name: "Test" }),
      ).rejects.toThrow("404 Not Found");
    });
  });

  describe("deleteUser", () => {
    it("calls DELETE /users/:id", async () => {
      mockClient.delete.mockResolvedValue({ status: 204 });

      await deleteUser("u-1");

      expect(mockClient.delete).toHaveBeenCalledWith("/users/u-1");
    });

    it("propagates errors on delete", async () => {
      mockClient.delete.mockRejectedValue(new Error("403 Forbidden"));

      await expect(deleteUser("u-1")).rejects.toThrow("403 Forbidden");
    });
  });
});
