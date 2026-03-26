import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import type { Scenario } from "@/types/scenario";

vi.mock("@/api/scenarios", () => ({
  getScenarios: vi.fn(),
  getActiveScenarios: vi.fn(),
  getScenario: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
  cloneScenario: vi.fn(),
}));

import {
  getScenarios,
  getActiveScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  cloneScenario,
} from "@/api/scenarios";
import {
  useScenarios,
  useActiveScenarios,
  useScenario,
  useCreateScenario,
  useUpdateScenario,
  useDeleteScenario,
  useCloneScenario,
} from "@/hooks/use-scenarios";

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
  items: [{ id: "s1", name: "Scenario 1" } as Scenario],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("useScenarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch scenarios with params", async () => {
    vi.mocked(getScenarios).mockResolvedValueOnce(mockPaginated);

    const { result } = renderHook(() => useScenarios({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScenarios).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual(mockPaginated);
  });
});

describe("useActiveScenarios", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch active scenarios", async () => {
    vi.mocked(getActiveScenarios).mockResolvedValueOnce([{ id: "s1", name: "Scenario 1" } as Scenario]);

    const { result } = renderHook(() => useActiveScenarios(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getActiveScenarios).toHaveBeenCalledWith(undefined);
  });
});

describe("useScenario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch a single scenario by id", async () => {
    const mockScenario = { id: "s1", name: "Scenario 1" } as Scenario;
    vi.mocked(getScenario).mockResolvedValueOnce(mockScenario);

    const { result } = renderHook(() => useScenario("s1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getScenario).toHaveBeenCalledWith("s1");
  });

  it("should not fetch when id is undefined", () => {
    const { result } = renderHook(() => useScenario(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getScenario).not.toHaveBeenCalled();
  });
});

describe("useCreateScenario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create a scenario and invalidate queries", async () => {
    const newScenario = { id: "s2", name: "New" } as Scenario;
    vi.mocked(createScenario).mockResolvedValueOnce(newScenario);

    const { result } = renderHook(() => useCreateScenario(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      name: "New",
      product: "Drug A",
      hcp_profile_id: "h1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createScenario).toHaveBeenCalled();
  });
});

describe("useUpdateScenario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should update a scenario", async () => {
    vi.mocked(updateScenario).mockResolvedValueOnce({
      id: "s1",
      name: "Updated",
    } as Scenario);

    const { result } = renderHook(() => useUpdateScenario(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "s1", data: { name: "Updated" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateScenario).toHaveBeenCalledWith("s1", { name: "Updated" });
  });
});

describe("useDeleteScenario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should delete a scenario", async () => {
    vi.mocked(deleteScenario).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteScenario(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("s1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteScenario).toHaveBeenCalledWith("s1");
  });
});

describe("useCloneScenario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should clone a scenario", async () => {
    vi.mocked(cloneScenario).mockResolvedValueOnce({
      id: "s3",
      name: "Clone",
    } as Scenario);

    const { result } = renderHook(() => useCloneScenario(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("s1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cloneScenario).toHaveBeenCalledWith("s1");
  });
});
