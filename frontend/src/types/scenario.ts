export interface ScoringWeights {
  key_message_delivery: number;
  objection_handling: number;
  communication_skills: number;
  product_knowledge: number;
  scientific_information: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  product: string;
  therapeutic_area: string;
  mode: "f2f" | "conference";
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "draft";
  hcp_profile_id: string | null;
  hcp_profile?: {
    id: string;
    name: string;
    specialty: string;
    personality_type: string;
    avatar_url?: string;
  };
  key_messages: string[];
  scoring_weights: ScoringWeights;
  pass_threshold: number;
  estimated_duration: number;
  created_at: string;
  updated_at: string;
}

export interface ScenarioCreate {
  name: string;
  description: string;
  product: string;
  therapeutic_area: string;
  mode: "f2f" | "conference";
  difficulty: "easy" | "medium" | "hard";
  hcp_profile_id: string | null;
  key_messages: string[];
  scoring_weights: ScoringWeights;
  pass_threshold: number;
  estimated_duration: number;
}

export interface ScenarioUpdate extends Partial<ScenarioCreate> {}
