import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "@/api/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ModelOption {
  value: string;
  label: string;
}

/** Shared cache so multiple ModelSelector instances don't re-fetch. */
let cachedOptions: ModelOption[] | null = null;

/**
 * Reusable model deployment selector.
 *
 * Fetches available model deployments from `/azure-config/model-deployments`
 * (reads from AI Foundry service configs). All pages that need a model
 * dropdown should use this component.
 */
export function ModelSelector({
  value,
  onValueChange,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("common");
  const [options, setOptions] = useState<ModelOption[]>(cachedOptions ?? []);
  const [loading, setLoading] = useState(!cachedOptions);

  useEffect(() => {
    if (cachedOptions) return;
    setLoading(true);
    apiClient
      .get<ModelOption[]>("/azure-config/model-deployments")
      .then(({ data }) => {
        cachedOptions = data;
        setOptions(data);
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={t("loading", "Loading...")} />
        </SelectTrigger>
      </Select>
    );
  }

  if (options.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={t("noModels", "No models configured")} />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Hook to access the model options list (for pages that need the raw data). */
export function useModelOptions(): {
  options: ModelOption[];
  loading: boolean;
} {
  const [options, setOptions] = useState<ModelOption[]>(cachedOptions ?? []);
  const [loading, setLoading] = useState(!cachedOptions);

  useEffect(() => {
    if (cachedOptions) {
      setOptions(cachedOptions);
      setLoading(false);
      return;
    }
    apiClient
      .get<ModelOption[]>("/azure-config/model-deployments")
      .then(({ data }) => {
        cachedOptions = data;
        setOptions(data);
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  return { options, loading };
}
