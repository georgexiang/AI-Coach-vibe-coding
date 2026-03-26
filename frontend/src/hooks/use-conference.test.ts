import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, createElement } from "react";

vi.mock("@/api/conference", () => ({
  createConferenceSession: vi.fn(),
  getConferenceSession: vi.fn(),
  endConferenceSession: vi.fn(),
  updateSubState: vi.fn(),
  getAudienceHcps: vi.fn(),
  setAudienceHcps: vi.fn(),
}));

import {
  createConferenceSession,
  getConferenceSession,
  endConferenceSession,
  updateSubState,
  getAudienceHcps,
  setAudienceHcps,
} from "@/api/conference";
import {
  useConferenceSession,
  useCreateConferenceSession,
  useEndConferenceSession,
  useUpdateSubState,
  useAudienceHcps,
  useSetAudienceHcps,
} from "@/hooks/use-conference";

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

describe("useConferenceSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch conference session by id", async () => {
    const session = { id: "cs-1", status: "in_progress" };
    vi.mocked(getConferenceSession).mockResolvedValueOnce(session as never);

    const { result } = renderHook(() => useConferenceSession("cs-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getConferenceSession).toHaveBeenCalledWith("cs-1");
    expect(result.current.data).toEqual(session);
  });

  it("should not fetch when sessionId is undefined", () => {
    const { result } = renderHook(() => useConferenceSession(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getConferenceSession).not.toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    vi.mocked(getConferenceSession).mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => useConferenceSession("bad"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateConferenceSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create a conference session", async () => {
    const session = { id: "cs-new", status: "created" };
    vi.mocked(createConferenceSession).mockResolvedValueOnce(session as never);

    const { result } = renderHook(() => useCreateConferenceSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("sc-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createConferenceSession).toHaveBeenCalledWith("sc-1");
  });

  it("should handle creation failure", async () => {
    vi.mocked(createConferenceSession).mockRejectedValueOnce(new Error("400"));

    const { result } = renderHook(() => useCreateConferenceSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("bad");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useEndConferenceSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should end a conference session", async () => {
    vi.mocked(endConferenceSession).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useEndConferenceSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("cs-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(endConferenceSession).toHaveBeenCalledWith("cs-1");
  });
});

describe("useUpdateSubState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should update sub-state", async () => {
    vi.mocked(updateSubState).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpdateSubState(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ sessionId: "cs-1", subState: "qa" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateSubState).toHaveBeenCalledWith("cs-1", "qa");
  });
});

describe("useAudienceHcps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch audience HCPs by scenario id", async () => {
    const hcps = [{ id: "hcp-1", hcpName: "Dr. Smith" }];
    vi.mocked(getAudienceHcps).mockResolvedValueOnce(hcps as never);

    const { result } = renderHook(() => useAudienceHcps("sc-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAudienceHcps).toHaveBeenCalledWith("sc-1");
    expect(result.current.data).toEqual(hcps);
  });

  it("should not fetch when scenarioId is undefined", () => {
    const { result } = renderHook(() => useAudienceHcps(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getAudienceHcps).not.toHaveBeenCalled();
  });
});

describe("useSetAudienceHcps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should set audience HCPs", async () => {
    const output = [{ id: "ah-1", hcpProfileId: "hp-1" }];
    vi.mocked(setAudienceHcps).mockResolvedValueOnce(output as never);

    const { result } = renderHook(() => useSetAudienceHcps(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      scenarioId: "sc-1",
      hcps: [{ hcpProfileId: "hp-1" }],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setAudienceHcps).toHaveBeenCalledWith("sc-1", [
      { hcpProfileId: "hp-1" },
    ]);
  });
});
