export type SkillStatus = "draft" | "review" | "published" | "archived" | "failed";

export type ConversionStatus = "pending" | "processing" | "completed" | "failed";

export type ResourceType = "reference" | "script" | "asset";

export type QualityVerdict = "PASS" | "NEEDS_REVIEW" | "FAIL";

export interface SkillResource {
  id: string;
  skill_id: string;
  version_id: string | null;
  resource_type: string;
  filename: string;
  content_type: string;
  file_size: number;
  extraction_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillVersion {
  id: string;
  skill_id: string;
  version_number: number;
  content: string;
  metadata_json: string;
  change_notes: string;
  is_published: boolean;
  created_by: string;
  created_at: string;
}

export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  product: string;
  status: SkillStatus;
  tags: string;
  quality_score: number | null;
  quality_verdict: QualityVerdict | null;
  structure_check_passed: boolean | null;
  conversion_status: ConversionStatus | null;
  current_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Skill extends SkillListItem {
  therapeutic_area: string;
  compatibility: string;
  metadata_json: string;
  content: string;
  structure_check_details: string;
  quality_details: string;
  conversion_error: string;
  resources: SkillResource[];
  versions: SkillVersion[];
}

export interface SkillCreate {
  name: string;
  description?: string;
  product?: string;
  therapeutic_area?: string;
  compatibility?: string;
  tags?: string;
  content?: string;
  metadata_json?: string;
}

export interface SkillUpdate extends Partial<SkillCreate> {
  status?: SkillStatus;
}

export interface StructureCheckIssue {
  severity: string;
  dimension: string;
  message: string;
  suggestion: string;
}

export interface StructureCheckResult {
  passed: boolean;
  score: number;
  issues: StructureCheckIssue[];
  content_hash: string;
}

export interface QualityDimension {
  name: string;
  score: number;
  verdict: string;
  strengths: string[];
  improvements: string[];
  critical_issues: string[];
  rationale: string;
}

export interface QualityEvaluation {
  overall_score: number;
  overall_verdict: string;
  dimensions: QualityDimension[];
  summary: string;
  top_improvements: string[];
  content_hash: string;
  evaluated_at: string;
}

export interface SkillEvaluationSummary {
  structure_check: {
    passed: boolean | null;
    details: StructureCheckResult | Record<string, never>;
  };
  quality: {
    score: number | null;
    verdict: string | null;
    details: QualityEvaluation | Record<string, never>;
    is_stale: boolean;
  };
}

export interface PaginatedSkills {
  items: SkillListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
