import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import type { AudienceHcp } from "@/types/conference";

vi.mock("@/api/conference", () => ({
  getAudienceHcps: vi.fn(),
  setAudienceHcps: vi.fn(),
}));

import { getAudienceHcps, setAudienceHcps } from "@/api/conference";
import {
  useAudienceHcps,
  useSetAudienceHcps,
} from "@/hooks/use-conference-audience";

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

const mockAudience: AudienceHcp[] = [
  {
    id: "ah-1",
    scenarioId: "sc-1",
    hcpProfileId: "hcp-1",
    hcpName: "Dr. Smith",
    hcpSpecialty: "Oncology",
    roleInConference: "audience",
    voiceId: "",
    sortOrder: 0,
    status: "listening",
  },
];

describe("useAudienceHcps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches audience when scenarioId provided", async () => {
    vi.mocked(getAudienceHcps).mockResolvedValueOnce(mockAudience);

    const { result } = renderHook(() => useAudienceHcps("sc-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAudienceHcps).toHaveBeenCalledWith("sc-1");
    expect(result.current.data).toEqual(mockAudience);
  });

  it("is disabled when scenarioId is undefined", () => {
    const { result } = renderHook(() => useAudienceHcps(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getAudienceHcps).not.toHaveBeenCalled();
  });
});

describe("useSetAudienceHcps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls setAudienceHcps with scenarioId and hcps", async () => {
    vi.mocked(setAudienceHcps).mockResolvedValueOnce(mockAudience);

    const { result } = renderHook(() => useSetAudienceHcps(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      scenarioId: "sc-1",
      hcps: [{ hcpProfileId: "hcp-1" }, { hcpProfileId: "hcp-2" }],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setAudienceHcps).toHaveBeenCalledWith("sc-1", [
      { hcpProfileId: "hcp-1" },
      { hcpProfileId: "hcp-2" },
    ]);
  });
});
