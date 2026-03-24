export interface StrengthItem {
  text: string;
  quote: string | null;
}

export interface WeaknessItem {
  text: string;
  quote: string | null;
}

export interface ImprovementSuggestion {
  dimension: string;
  suggestion: string;
  priority: string;
}

export interface DimensionBreakdown {
  dimension: string;
  score: number;
  weight: number;
  max_score: number;
  strengths: StrengthItem[];
  weaknesses: WeaknessItem[];
  suggestions: string[];
}

export interface SessionReport {
  session_id: string;
  scenario_name: string;
  product: string;
  hcp_name: string;
  overall_score: number;
  passed: boolean;
  feedback_summary: string;
  duration_seconds: number | null;
  completed_at: string | null;
  dimensions: DimensionBreakdown[];
  strengths: StrengthItem[];
  weaknesses: WeaknessItem[];
  improvements: ImprovementSuggestion[];
  key_messages_delivered: number;
  key_messages_total: number;
}

export type SuggestionType = "tip" | "warning" | "achievement" | "reminder";

export interface SuggestionResponse {
  type: SuggestionType;
  message: string;
  relevance_score: number;
  trigger: string;
}

export interface ScoreHistoryItem {
  session_id: string;
  scenario_name: string;
  overall_score: number;
  passed: boolean;
  completed_at: string;
  dimensions: Array<{
    dimension: string;
    score: number;
    weight: number;
    improvement_pct: number | null;
  }>;
}
