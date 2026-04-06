import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteUser, getUsers, updateUser } from "@/api/users";
import type { UserUpdate } from "@/api/users";

export function useUsers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => getUsers(params),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserUpdate }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
