import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/api/client";
import { useAuthStore } from "@/stores/auth-store";
import type { LoginRequest, TokenResponse, User } from "@/types/auth";

export function useLogin() {
  const { setAuth } = useAuthStore();
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const res = await apiClient.post<TokenResponse>("/auth/login", data);
      localStorage.setItem("access_token", res.data.access_token);
      const meRes = await apiClient.get<User>("/auth/me");
      setAuth(res.data.access_token, meRes.data);
      return meRes.data;
    },
  });
}

export function useMe() {
  const { token, setAuth, clearAuth } = useAuthStore();
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<User>("/auth/me");
        if (token) setAuth(token, res.data);
        return res.data;
      } catch {
        clearAuth();
        throw new Error("Failed to fetch user");
      }
    },
    enabled: !!token,
    retry: false,
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();
  return useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);
}
