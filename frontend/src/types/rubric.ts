export interface DimensionConfig {
  name: string;
  weight: number;
  criteria: string[];
  max_score: number;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  scenario_type: string;
  dimensions: DimensionConfig[];
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  content_weight?: number; // 0-100, default 60
  voice_weight?: number; // 0-100, default 40 (derived)
}

export interface RubricCreate {
  name: string;
  description?: string;
  scenario_type?: string;
  dimensions: DimensionConfig[];
  is_default?: boolean;
  content_weight?: number; // 0-100, default 60
  voice_weight?: number; // 0-100, default 40
}

export interface RubricUpdate {
  name?: string;
  description?: string;
  scenario_type?: string;
  dimensions?: DimensionConfig[];
  is_default?: boolean;
  content_weight?: number;
  voice_weight?: number;
}
