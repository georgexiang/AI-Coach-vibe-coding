export interface UserDashboardStats {
  total_sessions: number;
  avg_score: number;
  this_week: number;
  improvement: number | null;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  weight: number;
}

export interface DimensionTrendPoint {
  session_id: string;
  completed_at: string | null;
  scenario_name: string;
  overall_score: number;
  dimensions: DimensionScore[];
}

export interface BuStats {
  business_unit: string;
  session_count: number;
  avg_score: number;
  user_count: number;
}

export interface SkillGapCell {
  business_unit: string;
  dimension: string;
  avg_score: number;
}

export interface OrgAnalytics {
  total_users: number;
  active_users: number;
  completion_rate: number;
  total_sessions: number;
  avg_org_score: number;
  bu_stats: BuStats[];
  skill_gaps: SkillGapCell[];
}

export interface RecommendedScenarioItem {
  scenario_id: string;
  scenario_name: string;
  product: string;
  difficulty: string;
  reason: string;
  target_dimension: string;
}
