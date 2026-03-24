import axios from "axios";
import { clearAuth } from "@/stores/auth-store";

const apiClient = axios.create({
  baseURL: "/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
// Uses clearAuth() to update React state instead of window.location.href
// which would cause a full page reload and potential infinite loop.
// React router guards (GuestRoute/ProtectedRoute) handle the redirect.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
