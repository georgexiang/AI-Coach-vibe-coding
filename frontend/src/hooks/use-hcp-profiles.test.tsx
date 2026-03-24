import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import type { HcpProfile } from "@/types/hcp";

vi.mock("@/api/hcp-profiles", () => ({
  getHcpProfiles: vi.fn(),
  getHcpProfile: vi.fn(),
  createHcpProfile: vi.fn(),
  updateHcpProfile: vi.fn(),
  deleteHcpProfile: vi.fn(),
}));

import {
  getHcpProfiles,
  getHcpProfile,
  createHcpProfile,
  updateHcpProfile,
  deleteHcpProfile,
} from "@/api/hcp-profiles";
import {
  useHcpProfiles,
  useHcpProfile,
  useCreateHcpProfile,
  useUpdateHcpProfile,
  useDeleteHcpProfile,
} from "@/hooks/use-hcp-profiles";

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

const mockProfiles = {
  items: [{ id: "h1", name: "Dr. Wang" } as HcpProfile],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("useHcpProfiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch HCP profiles with params", async () => {
    vi.mocked(getHcpProfiles).mockResolvedValueOnce(mockProfiles);

    const { result } = renderHook(
      () => useHcpProfiles({ page: 1, search: "wang" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getHcpProfiles).toHaveBeenCalledWith({
      page: 1,
      search: "wang",
    });
    expect(result.current.data).toEqual(mockProfiles);
  });

  it("should fetch HCP profiles without params", async () => {
    vi.mocked(getHcpProfiles).mockResolvedValueOnce(mockProfiles);

    const { result } = renderHook(() => useHcpProfiles(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getHcpProfiles).toHaveBeenCalledWith(undefined);
  });
});

describe("useHcpProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch a single HCP profile", async () => {
    const profile = { id: "h1", name: "Dr. Wang" } as HcpProfile;
    vi.mocked(getHcpProfile).mockResolvedValueOnce(profile);

    const { result } = renderHook(() => useHcpProfile("h1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getHcpProfile).toHaveBeenCalledWith("h1");
  });

  it("should not fetch when id is undefined", () => {
    const { result } = renderHook(() => useHcpProfile(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getHcpProfile).not.toHaveBeenCalled();
  });
});

describe("useCreateHcpProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create an HCP profile", async () => {
    const newProfile = { id: "h2", name: "Dr. Li" } as HcpProfile;
    vi.mocked(createHcpProfile).mockResolvedValueOnce(newProfile);

    const { result } = renderHook(() => useCreateHcpProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Dr. Li", specialty: "Oncology" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createHcpProfile).toHaveBeenCalledWith({
      name: "Dr. Li",
      specialty: "Oncology",
    });
  });
});

describe("useUpdateHcpProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should update an HCP profile", async () => {
    vi.mocked(updateHcpProfile).mockResolvedValueOnce({
      id: "h1",
      name: "Dr. Wang Updated",
    } as HcpProfile);

    const { result } = renderHook(() => useUpdateHcpProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "h1", data: { name: "Dr. Wang Updated" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateHcpProfile).toHaveBeenCalledWith("h1", {
      name: "Dr. Wang Updated",
    });
  });
});

describe("useDeleteHcpProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should delete an HCP profile", async () => {
    vi.mocked(deleteHcpProfile).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteHcpProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("h1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteHcpProfile).toHaveBeenCalledWith("h1");
  });
});
