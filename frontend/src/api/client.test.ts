import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so the mock function is available when vi.mock factory runs
const mockClearAuth = vi.hoisted(() => vi.fn());

vi.mock("@/stores/auth-store", () => ({
  clearAuth: mockClearAuth,
}));

import apiClient from "@/api/client";

describe("api/client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should have baseURL set to /api/v1", () => {
    expect(apiClient.defaults.baseURL).toBe("/api/v1");
  });

  it("should have 30s timeout", () => {
    expect(apiClient.defaults.timeout).toBe(30000);
  });

  it("should have Content-Type header set to application/json", () => {
    expect(apiClient.defaults.headers["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("should attach Authorization header when token exists", () => {
    localStorage.setItem("access_token", "my-jwt-token");

    const requestInterceptor = apiClient.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (
          config: Record<string, unknown>,
        ) => Record<string, unknown>;
      }>;
    };
    const handler = requestInterceptor.handlers[0];
    expect(handler).toBeDefined();

    const config = { headers: {} as Record<string, string> };
    const result = handler!.fulfilled(config) as {
      headers: Record<string, string>;
    };
    expect(result.headers["Authorization"]).toBe("Bearer my-jwt-token");
  });

  it("should not attach Authorization header when no token", () => {
    const requestInterceptor = apiClient.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (
          config: Record<string, unknown>,
        ) => Record<string, unknown>;
      }>;
    };
    const handler = requestInterceptor.handlers[0];

    const config = { headers: {} as Record<string, string> };
    const result = handler!.fulfilled(config) as {
      headers: Record<string, string>;
    };
    expect(result.headers["Authorization"]).toBeUndefined();
  });

  it("should call clearAuth on 401 response error", async () => {
    const responseInterceptor = apiClient.interceptors.response as unknown as {
      handlers: Array<{
        fulfilled: (response: unknown) => unknown;
        rejected: (error: unknown) => unknown;
      }>;
    };
    const handler = responseInterceptor.handlers[0];
    expect(handler).toBeDefined();

    const error = { response: { status: 401 } };

    await expect(handler!.rejected(error)).rejects.toEqual(error);
    expect(mockClearAuth).toHaveBeenCalled();
  });

  it("should not call clearAuth on non-401 errors", async () => {
    const responseInterceptor = apiClient.interceptors.response as unknown as {
      handlers: Array<{
        fulfilled: (response: unknown) => unknown;
        rejected: (error: unknown) => unknown;
      }>;
    };
    const handler = responseInterceptor.handlers[0];

    const error = { response: { status: 500 } };

    await expect(handler!.rejected(error)).rejects.toEqual(error);
    expect(mockClearAuth).not.toHaveBeenCalled();
  });

  it("should pass through successful responses", () => {
    const responseInterceptor = apiClient.interceptors.response as unknown as {
      handlers: Array<{
        fulfilled: (response: unknown) => unknown;
        rejected: (error: unknown) => unknown;
      }>;
    };
    const handler = responseInterceptor.handlers[0];

    const response = { status: 200, data: { ok: true } };
    const result = handler!.fulfilled(response);
    expect(result).toEqual(response);
  });
});
