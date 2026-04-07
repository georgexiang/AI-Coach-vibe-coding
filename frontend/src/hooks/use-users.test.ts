import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/users", () => ({
  getUsers: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

import { getUsers, updateUser, deleteUser } from "@/api/users";
import type { AdminUser } from "@/api/users";
import { useUsers, useUpdateUser, useDeleteUser } from "./use-users";

const mockedGetUsers = vi.mocked(getUsers);
const mockedUpdateUser = vi.mocked(updateUser);
const mockedDeleteUser = vi.mocked(deleteUser);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

const mockUser: AdminUser = {
  id: "u1",
  username: "john",
  email: "john@example.com",
  full_name: "John Doe",
  role: "mr",
  is_active: true,
  preferred_language: "en",
  business_unit: "Oncology",
  created_at: "2026-01-01T00:00:00Z",
};

const mockUsersResponse = {
  items: [mockUser],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("useUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches users without params", async () => {
    mockedGetUsers.mockResolvedValueOnce(mockUsersResponse);

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetUsers).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockUsersResponse);
  });

  it("fetches users with params", async () => {
    mockedGetUsers.mockResolvedValueOnce(mockUsersResponse);

    const params = { page: 2, page_size: 10, search: "john", role: "mr" };
    const { result } = renderHook(() => useUsers(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetUsers).toHaveBeenCalledWith(params);
  });

  it("returns error state when fetch fails", async () => {
    mockedGetUsers.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it("returns loading state initially", () => {
    mockedGetUsers.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useUpdateUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a user with correct params", async () => {
    const updatedUser = { ...mockUser, full_name: "John Updated" };
    mockedUpdateUser.mockResolvedValueOnce(updatedUser);

    const { result } = renderHook(() => useUpdateUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "u1", data: { full_name: "John Updated" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedUpdateUser).toHaveBeenCalledWith("u1", {
      full_name: "John Updated",
    });
  });

  it("invalidates admin-users queries on success", async () => {
    mockedUpdateUser.mockResolvedValueOnce(mockUser);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useUpdateUser(), {
      wrapper: Wrapper,
    });

    result.current.mutate({ id: "u1", data: { role: "admin" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin-users"],
    });
  });

  it("sets error state when mutation fails", async () => {
    mockedUpdateUser.mockRejectedValueOnce(new Error("Update failed"));

    const { result } = renderHook(() => useUpdateUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "u1", data: { role: "admin" } });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useDeleteUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a user by id", async () => {
    mockedDeleteUser.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDeleteUser).toHaveBeenCalledWith("u1");
  });

  it("invalidates admin-users queries on success", async () => {
    mockedDeleteUser.mockResolvedValueOnce(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    }

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: Wrapper,
    });

    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin-users"],
    });
  });

  it("sets error state when delete fails", async () => {
    mockedDeleteUser.mockRejectedValueOnce(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteUser(), {
      wrapper: createWrapper(),
    });

    result.current.mutate("u1");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
