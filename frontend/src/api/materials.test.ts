import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "./client";
import {
  getMaterials,
  getMaterial,
  uploadMaterial,
  updateMaterial,
  archiveMaterial,
  restoreMaterial,
  getMaterialVersions,
} from "./materials";

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

describe("Materials API client", () => {
  it("getMaterials calls GET /materials with params", async () => {
    const mockData = { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 };
    mockClient.get.mockResolvedValue({ data: mockData });

    const result = await getMaterials({ page: 1, product: "Brukinsa" });

    expect(mockClient.get).toHaveBeenCalledWith("/materials", {
      params: { page: 1, product: "Brukinsa" },
    });
    expect(result).toEqual(mockData);
  });

  it("getMaterials works without params", async () => {
    const mockData = { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 };
    mockClient.get.mockResolvedValue({ data: mockData });

    await getMaterials();

    expect(mockClient.get).toHaveBeenCalledWith("/materials", { params: undefined });
  });

  it("getMaterial calls GET /materials/:id", async () => {
    const mockMaterial = { id: "m1", name: "Test", product: "Drug" };
    mockClient.get.mockResolvedValue({ data: mockMaterial });

    const result = await getMaterial("m1");

    expect(mockClient.get).toHaveBeenCalledWith("/materials/m1");
    expect(result.id).toBe("m1");
  });

  it("uploadMaterial sends FormData with multipart", async () => {
    const mockResult = { id: "m1", name: "Doc", product: "Drug", current_version: 1 };
    mockClient.post.mockResolvedValue({ data: mockResult });

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const result = await uploadMaterial(file, "Drug", "My Doc");

    expect(mockClient.post).toHaveBeenCalledWith(
      "/materials",
      expect.any(FormData),
      expect.objectContaining({
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
    expect(result.id).toBe("m1");
  });

  it("uploadMaterial includes optional fields when provided", async () => {
    mockClient.post.mockResolvedValue({ data: { id: "m1" } });

    const file = new File(["content"], "test.pdf");
    await uploadMaterial(file, "Drug", "Doc", "Oncology", "tag1", "existing-id");

    const formData = mockClient.post.mock.calls[0]![1] as FormData;
    expect(formData.get("therapeutic_area")).toBe("Oncology");
    expect(formData.get("tags")).toBe("tag1");
    expect(formData.get("material_id")).toBe("existing-id");
  });

  it("updateMaterial calls PUT /materials/:id", async () => {
    const mockResult = { id: "m1", name: "Updated" };
    mockClient.put.mockResolvedValue({ data: mockResult });

    const result = await updateMaterial("m1", { name: "Updated" });

    expect(mockClient.put).toHaveBeenCalledWith("/materials/m1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("archiveMaterial calls DELETE /materials/:id", async () => {
    mockClient.delete.mockResolvedValue({});

    await archiveMaterial("m1");

    expect(mockClient.delete).toHaveBeenCalledWith("/materials/m1");
  });

  it("restoreMaterial calls POST /materials/:id/restore", async () => {
    const mockResult = { id: "m1", is_archived: false };
    mockClient.post.mockResolvedValue({ data: mockResult });

    const result = await restoreMaterial("m1");

    expect(mockClient.post).toHaveBeenCalledWith("/materials/m1/restore");
    expect(result.is_archived).toBe(false);
  });

  it("getMaterialVersions calls GET /materials/:id/versions", async () => {
    const mockVersions = [{ id: "v1", version_number: 1 }];
    mockClient.get.mockResolvedValue({ data: mockVersions });

    const result = await getMaterialVersions("m1");

    expect(mockClient.get).toHaveBeenCalledWith("/materials/m1/versions");
    expect(result).toHaveLength(1);
  });

});
