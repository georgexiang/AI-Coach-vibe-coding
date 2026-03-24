import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock api client
vi.mock("@/api/client", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock auth store
const mockSetAuth = vi.fn();
const mockClearAuth = vi.fn();
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    token: "test-token",
    setAuth: mockSetAuth,
    clearAuth: mockClearAuth,
  }),
}));

import apiClient from "@/api/client";
import { useLogin, useMe, useLogout } from "@/hooks/use-auth";

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

describe("useLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should login, store token, fetch user, and call setAuth", async () => {
    const mockToken = { access_token: "jwt-123", token_type: "bearer" };
    const mockUser = {
      id: "u1",
      username: "test",
      email: "t@t.com",
      full_name: "Test",
      role: "user" as const,
      is_active: true,
      preferred_language: "en-US",
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockToken });
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockUser });

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ username: "test", password: "pass" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
      username: "test",
      password: "pass",
    });
    expect(localStorage.getItem("access_token")).toBe("jwt-123");
    expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    expect(mockSetAuth).toHaveBeenCalledWith("jwt-123", mockUser);
  });

  it("should report error when login fails", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("401"));

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ username: "bad", password: "wrong" });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useMe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch current user and call setAuth on success", async () => {
    const mockUser = {
      id: "u1",
      username: "test",
      email: "t@t.com",
      full_name: "Test",
      role: "user" as const,
      is_active: true,
      preferred_language: "en-US",
    };

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockUser });

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    expect(mockSetAuth).toHaveBeenCalledWith("test-token", mockUser);
  });

  it("should call clearAuth and throw when fetch fails", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockClearAuth).toHaveBeenCalled();
  });
});

describe("useLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear auth and navigate to /login", () => {
    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    result.current();

    expect(mockClearAuth).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
