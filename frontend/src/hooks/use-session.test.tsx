import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

vi.mock("@/api/sessions", () => ({
  createSession: vi.fn(),
  getUserSessions: vi.fn(),
  getSession: vi.fn(),
  getSessionMessages: vi.fn(),
  endSession: vi.fn(),
}));

import {
  createSession,
  getUserSessions,
  getSession,
  getSessionMessages,
  endSession,
} from "@/api/sessions";
import {
  useUserSessions,
  useSession,
  useSessionMessages,
  useCreateSession,
  useEndSession,
} from "@/hooks/use-session";

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

const mockSessions = {
  items: [{ id: "sess1", status: "in_progress" }],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("useUserSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch user sessions", async () => {
    vi.mocked(getUserSessions).mockResolvedValueOnce(mockSessions);

    const { result } = renderHook(() => useUserSessions({ page: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserSessions).toHaveBeenCalledWith({ page: 1 });
    expect(result.current.data).toEqual(mockSessions);
  });
});

describe("useSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch a session by id", async () => {
    const session = { id: "sess1", status: "in_progress" };
    vi.mocked(getSession).mockResolvedValueOnce(session);

    const { result } = renderHook(() => useSession("sess1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSession).toHaveBeenCalledWith("sess1");
  });

  it("should not fetch when id is undefined", () => {
    const { result } = renderHook(() => useSession(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe("useSessionMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fetch session messages", async () => {
    const messages = [
      { id: "m1", session_id: "sess1", role: "user", content: "Hello" },
    ];
    vi.mocked(getSessionMessages).mockResolvedValueOnce(messages);

    const { result } = renderHook(() => useSessionMessages("sess1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getSessionMessages).toHaveBeenCalledWith("sess1");
  });

  it("should not fetch when sessionId is undefined", () => {
    const { result } = renderHook(() => useSessionMessages(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(getSessionMessages).not.toHaveBeenCalled();
  });
});

describe("useCreateSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should create a session", async () => {
    const newSession = { id: "sess2", status: "created" };
    vi.mocked(createSession).mockResolvedValueOnce(newSession);

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("scenario-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createSession).toHaveBeenCalledWith("scenario-1");
  });
});

describe("useEndSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should end a session", async () => {
    const endedSession = { id: "sess1", status: "completed" };
    vi.mocked(endSession).mockResolvedValueOnce(endedSession);

    const { result } = renderHook(() => useEndSession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("sess1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(endSession).toHaveBeenCalledWith("sess1");
  });
});
