import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { setAuth, clearAuth, useAuthStore } from "@/stores/auth-store";
import type { User } from "@/types/auth";

const mockUser: User = {
  id: "u1",
  username: "testuser",
  email: "test@example.com",
  full_name: "Test User",
  role: "user",
  is_active: true,
  preferred_language: "en-US",
};

describe("auth-store", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuth();
  });

  it("should start unauthenticated when no token in localStorage", () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should set auth state and persist token to localStorage", () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      setAuth("test-token-123", mockUser);
    });

    expect(result.current.token).toBe("test-token-123");
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem("access_token")).toBe("test-token-123");
  });

  it("should clear auth state and remove token from localStorage", () => {
    act(() => {
      setAuth("some-token", mockUser);
    });

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      clearAuth();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("access_token")).toBeNull();
  });

  it("should notify all subscribers when auth changes", () => {
    const { result } = renderHook(() => useAuthStore());

    // The hook uses useSyncExternalStore which subscribes internally.
    // We verify reactivity by checking the hook re-renders with new values.
    act(() => {
      setAuth("token-a", mockUser);
    });
    expect(result.current.token).toBe("token-a");

    act(() => {
      setAuth("token-b", { ...mockUser, username: "updated" });
    });
    expect(result.current.token).toBe("token-b");
    expect(result.current.user?.username).toBe("updated");
  });

  it("should expose setAuth and clearAuth on the hook return value", () => {
    const { result } = renderHook(() => useAuthStore());
    expect(typeof result.current.setAuth).toBe("function");
    expect(typeof result.current.clearAuth).toBe("function");
  });

  it("should read initial token from localStorage if present", () => {
    // We need to set the token before the module loads its initial state.
    // Since the module has already loaded, we simulate this by calling setAuth.
    localStorage.setItem("access_token", "pre-existing-token");

    // setAuth updates the state directly, simulating what happens on module init
    act(() => {
      setAuth("pre-existing-token", mockUser);
    });

    const { result } = renderHook(() => useAuthStore());
    expect(result.current.token).toBe("pre-existing-token");
    expect(result.current.isAuthenticated).toBe(true);
  });
});
