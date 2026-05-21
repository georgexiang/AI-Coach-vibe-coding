export type DryRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type CoverageStatus = "covered" | "partial" | "not_covered";
export type IssueSeverity = "warning" | "error";

export interface DryRunMessage {
  id: string;
  dry_run_id: string;
  sequence_number: number;
  role: "mr" | "hcp";
  content: string;
  sop_step_id: string | null;
  sop_step_name: string | null;
  created_at: string;
}

export interface SopStepCoverage {
  step_id: string;
  step_name: string;
  status: CoverageStatus;
  matched_message_ids: string[];
  details: string;
}

export interface DryRunIssue {
  severity: IssueSeverity;
  step_id: string | null;
  description: string;
  suggestion: string;
}

export interface DryRunListItem {
  id: string;
  skill_id: string;
  run_number: number;
  status: DryRunStatus;
  executability_score: number | null;
  coverage_percent: number | null;
  total_sop_steps: number;
  covered_sop_steps: number;
  issues_count: number;
  duration_seconds: number | null;
  created_at: string;
}

export interface DryRun extends DryRunListItem {
  partial_sop_steps: number;
  sop_coverage: SopStepCoverage[];
  issues: DryRunIssue[];
  error_message: string;
  messages: DryRunMessage[];
  created_by: string;
}

export interface DryRunStatusResponse {
  status: DryRunStatus;
  covered_sop_steps: number;
  total_sop_steps: number;
  coverage_percent: number | null;
}

export interface PaginatedDryRuns {
  items: DryRunListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
