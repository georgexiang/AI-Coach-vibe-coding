import apiClient from "./client";

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  preferred_language: string;
  business_unit: string;
  created_at: string | null;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  preferred_language?: string;
  business_unit?: string;
}

export async function getUsers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}) {
  const { data } = await apiClient.get<{
    items: AdminUser[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }>("/users", { params });
  return data;
}

export async function updateUser(id: string, data: UserUpdate) {
  const { data: result } = await apiClient.patch<AdminUser>(`/users/${id}`, data);
  return result;
}

export async function deleteUser(id: string) {
  await apiClient.delete(`/users/${id}`);
}
