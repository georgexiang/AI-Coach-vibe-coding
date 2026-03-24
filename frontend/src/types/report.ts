export interface DimensionBreakdown {
  dimension: string;
  score: number;
  weight: number;
  strengths: string[];
  weaknesses: string[];
}

export interface StrengthItem {
  text: string;
  quote: string;
}

export interface WeaknessItem {
  text: string;
  quote: string;
}

export interface ImprovementSuggestion {
  dimension: string;
  priority: "high" | "medium" | "low";
  suggestion: string;
  example?: string;
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

export interface SuggestionResponse {
  id: string;
  dimension: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
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
