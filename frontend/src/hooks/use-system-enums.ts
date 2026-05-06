import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getSystemEnums,
  getSystemEnumCategories,
  createSystemEnum,
  updateSystemEnum,
  deleteSystemEnum,
} from "@/api/system-enums";
import type {
  SystemEnum,
  SystemEnumCreate,
  SystemEnumUpdate,
} from "@/types/system-enum";

/** Query key factory for system enums */
const systemEnumKeys = {
  all: ["system-enums"] as const,
  categories: () => [...systemEnumKeys.all, "categories"] as const,
  byCategory: (category: string) =>
    [...systemEnumKeys.all, category] as const,
};

/** Fetch enum values for a given category (active only by default) */
export function useSystemEnums(category: string, activeOnly: boolean = true) {
  return useQuery({
    queryKey: systemEnumKeys.byCategory(category),
    queryFn: () => getSystemEnums(category, activeOnly),
    enabled: !!category,
  });
}

/** Fetch all distinct categories */
export function useSystemEnumCategories() {
  return useQuery({
    queryKey: systemEnumKeys.categories(),
    queryFn: () => getSystemEnumCategories(),
  });
}

/** Create a new enum value */
export function useCreateSystemEnum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SystemEnumCreate) => createSystemEnum(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: systemEnumKeys.byCategory(variables.category),
      });
      queryClient.invalidateQueries({
        queryKey: systemEnumKeys.categories(),
      });
    },
  });
}

/** Update an existing enum value */
export function useUpdateSystemEnum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SystemEnumUpdate }) =>
      updateSystemEnum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemEnumKeys.all });
    },
  });
}

/** Delete an enum value */
export function useDeleteSystemEnum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSystemEnum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: systemEnumKeys.all });
    },
  });
}

/** Utility hook that returns a function to get the correct locale label */
export function useEnumLabel() {
  const { i18n } = useTranslation();
  return (item: SystemEnum) =>
    i18n.language.startsWith("zh")
      ? item.label_zh || item.label_en
      : item.label_en;
}
