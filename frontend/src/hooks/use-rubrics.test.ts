import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

vi.mock("@/api/rubrics", () => ({
  getRubrics: vi.fn(),
  createRubric: vi.fn(),
  updateRubric: vi.fn(),
  deleteRubric: vi.fn(),
}));

import { getRubrics, createRubric, updateRubric, deleteRubric } from "@/api/rubrics";
import {
  useRubrics,
  useCreateRubric,
  useUpdateRubric,
  useDeleteRubric,
} from "@/hooks/use-rubrics";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const mockRubric = {
  id: "r-1",
  name: "Default Rubric",
  description: "Test rubric",
  scenario_type: "f2f",
  dimensions: [{ name: "Knowledge", weight: 1, criteria: [], max_score: 100 }],
  is_default: true,
  created_by: "admin",
  created_at: "2026-03-20T10:00:00Z",
  updated_at: "2026-03-20T10:00:00Z",
};

describe("useRubrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch rubrics", async () => {
    vi.mocked(getRubrics).mockResolvedValueOnce([mockRubric]);

    const { result } = renderHook(() => useRubrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRubrics).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual([mockRubric]);
  });

  it("should fetch rubrics with scenario_type filter", async () => {
    vi.mocked(getRubrics).mockResolvedValueOnce([mockRubric]);

    const { result } = renderHook(
      () => useRubrics({ scenario_type: "f2f" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRubrics).toHaveBeenCalledWith({ scenario_type: "f2f" });
  });

  it("should handle fetch error", async () => {
    vi.mocked(getRubrics).mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => useRubrics(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateRubric", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create a rubric", async () => {
    vi.mocked(createRubric).mockResolvedValueOnce(mockRubric);

    const { result } = renderHook(() => useCreateRubric(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "Default Rubric",
      dimensions: [{ name: "Knowledge", weight: 1, criteria: [], max_score: 100 }],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createRubric).toHaveBeenCalledWith({
      name: "Default Rubric",
      dimensions: [{ name: "Knowledge", weight: 1, criteria: [], max_score: 100 }],
    });
  });

  it("should handle creation failure", async () => {
    vi.mocked(createRubric).mockRejectedValueOnce(new Error("422"));

    const { result } = renderHook(() => useCreateRubric(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "", dimensions: [] });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateRubric", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should update a rubric", async () => {
    vi.mocked(updateRubric).mockResolvedValueOnce({
      ...mockRubric,
      name: "Updated",
    });

    const { result } = renderHook(() => useUpdateRubric(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "r-1", data: { name: "Updated" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateRubric).toHaveBeenCalledWith("r-1", { name: "Updated" });
  });
});

describe("useDeleteRubric", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should delete a rubric", async () => {
    vi.mocked(deleteRubric).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteRubric(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("r-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteRubric).toHaveBeenCalledWith("r-1");
  });

  it("should handle deletion failure", async () => {
    vi.mocked(deleteRubric).mockRejectedValueOnce(new Error("404"));

    const { result } = renderHook(() => useDeleteRubric(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("missing");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
