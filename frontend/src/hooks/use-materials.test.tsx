import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

vi.mock("@/api/materials", () => ({
  getMaterials: vi.fn(),
  getMaterial: vi.fn(),
  getMaterialVersions: vi.fn(),
  getVersionChunks: vi.fn(),
  uploadMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  archiveMaterial: vi.fn(),
  restoreMaterial: vi.fn(),
}));

import {
  getMaterials,
  getMaterial,
  getMaterialVersions,
  getVersionChunks,
  uploadMaterial,
  updateMaterial,
  archiveMaterial,
  restoreMaterial,
} from "@/api/materials";
import {
  useMaterials,
  useMaterial,
  useMaterialVersions,
  useVersionChunks,
  useUploadMaterial,
  useUpdateMaterial,
  useArchiveMaterial,
  useRestoreMaterial,
} from "@/hooks/use-materials";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockPaginated = {
  items: [{ id: "m1", name: "Doc", product: "Drug" }],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("useMaterials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches materials list", async () => {
    vi.mocked(getMaterials).mockResolvedValueOnce(mockPaginated as never);

    const { result } = renderHook(() => useMaterials({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMaterials).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual(mockPaginated);
  });
});

describe("useMaterial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches material by id when provided", async () => {
    const mockMaterial = { id: "m1", name: "Doc" };
    vi.mocked(getMaterial).mockResolvedValueOnce(mockMaterial as never);

    const { result } = renderHook(() => useMaterial("m1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMaterial).toHaveBeenCalledWith("m1");
  });

  it("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => useMaterial(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getMaterial).not.toHaveBeenCalled();
  });
});

describe("useMaterialVersions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => useMaterialVersions(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getMaterialVersions).not.toHaveBeenCalled();
  });
});

describe("useVersionChunks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires both materialId and versionId", () => {
    const { result } = renderHook(() => useVersionChunks("m1", undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getVersionChunks).not.toHaveBeenCalled();
  });
});

describe("useUploadMaterial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls uploadMaterial and invalidates cache", async () => {
    vi.mocked(uploadMaterial).mockResolvedValueOnce({ id: "m1" } as never);

    const { result } = renderHook(() => useUploadMaterial(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      file: new File([""], "test.pdf"),
      product: "Drug",
      name: "Test",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(uploadMaterial).toHaveBeenCalled();
  });
});

describe("useUpdateMaterial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateMaterial and invalidates cache", async () => {
    vi.mocked(updateMaterial).mockResolvedValueOnce({ id: "m1" } as never);

    const { result } = renderHook(() => useUpdateMaterial(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "m1", data: { name: "Updated" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMaterial).toHaveBeenCalledWith("m1", { name: "Updated" });
  });
});

describe("useArchiveMaterial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls archiveMaterial and invalidates cache", async () => {
    vi.mocked(archiveMaterial).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useArchiveMaterial(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("m1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(archiveMaterial).toHaveBeenCalledWith("m1");
  });
});

describe("useRestoreMaterial", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls restoreMaterial and invalidates cache", async () => {
    vi.mocked(restoreMaterial).mockResolvedValueOnce({ id: "m1" } as never);

    const { result } = renderHook(() => useRestoreMaterial(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("m1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(restoreMaterial).toHaveBeenCalledWith("m1");
  });
});
