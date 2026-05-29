import type { DimensionConfig } from "@/types/rubric";

export interface RubricDimensionFormValue {
  name: string;
  weight: number;
  criteria: string;
  max_score: number;
}

export function createDefaultRubricDimension(): RubricDimensionFormValue {
  return { name: "", weight: 100, criteria: "", max_score: 100 };
}

export function toRubricDimensionFormValues(
  dimensions: Array<Partial<DimensionConfig>> | null | undefined,
): RubricDimensionFormValue[] {
  if (!dimensions?.length) {
    return [createDefaultRubricDimension()];
  }

  return dimensions.map((dimension) => ({
    name: dimension.name ?? "",
    weight: Number.isFinite(dimension.weight) ? dimension.weight ?? 0 : 0,
    criteria: Array.isArray(dimension.criteria) ? dimension.criteria.join(", ") : "",
    max_score: Number.isFinite(dimension.max_score) ? dimension.max_score ?? 100 : 100,
  }));
}

export function toRubricDimensions(
  dimensions: RubricDimensionFormValue[] | null | undefined,
): DimensionConfig[] {
  const formDimensions = dimensions?.length
    ? dimensions
    : [createDefaultRubricDimension()];

  return formDimensions.map((dimension) => ({
    name: dimension.name,
    weight: dimension.weight,
    criteria: (dimension.criteria ?? "")
      .split(",")
      .map((criterion) => criterion.trim())
      .filter(Boolean),
    max_score: dimension.max_score,
  }));
}
