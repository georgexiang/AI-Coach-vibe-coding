import type { TFunction } from "i18next";

/**
 * Map of legacy snake_case dimension keys to their i18n scoring namespace keys.
 * Used for backward compatibility with pre-refactor scored sessions.
 */
const LEGACY_DIMENSION_MAP: Record<string, string> = {
  key_message: "dimensions.keyMessage",
  objection_handling: "dimensions.objectionHandling",
  communication: "dimensions.communicationSkills",
  product_knowledge: "dimensions.productKnowledge",
  scientific_info: "dimensions.scientificInfo",
};

/**
 * Convert a snake_case or raw string to Title Case.
 * Examples: "key_message" -> "Key Message", "Clinical Data Accuracy" -> "Clinical Data Accuracy"
 */
function toTitleCase(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve a display-friendly name for a scoring dimension.
 *
 * Priority chain:
 * 1. i18n translation key `scoring:dimensions.{camelCase(key)}` (for legacy dimensions)
 * 2. Title Case conversion of the raw key (snake_case -> Title Case)
 *
 * New rubric-defined dimensions (e.g., "Clinical Data Accuracy") pass through
 * as-is since they are already human-readable names.
 */
export function getDimensionDisplayName(dimension: string, t: TFunction): string {
  // Check legacy mapping first
  const legacyKey = LEGACY_DIMENSION_MAP[dimension];
  if (legacyKey) {
    const translated = t(legacyKey, { ns: "scoring", defaultValue: "" });
    if (translated) return translated;
  }

  // If dimension contains underscores, it's likely a legacy key — convert to Title Case
  if (dimension.includes("_")) {
    return toTitleCase(dimension);
  }

  // New rubric dimensions are already human-readable
  return dimension;
}
