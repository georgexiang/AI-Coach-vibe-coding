import type { HcpProfile } from "./hcp";

export interface ScoringWeights {
  key_message: number;
  objection_handling: number;
  communication: number;
  product_knowledge: number;
  scientific_info: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  product: string;
  therapeutic_area: string;
  mode: "f2f" | "conference";
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "active";
  hcp_profile_id: string;
  hcp_profile?: HcpProfile;
  key_messages: string[];
  weight_key_message: number;
  weight_objection_handling: number;
  weight_communication: number;
  weight_product_knowledge: number;
  weight_scientific_info: number;
  pass_threshold: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScenarioCreate {
  name: string;
  product: string;
  hcp_profile_id: string;
  description?: string;
  therapeutic_area?: string;
  mode?: Scenario["mode"];
  difficulty?: Scenario["difficulty"];
  key_messages?: string[];
  weight_key_message?: number;
  weight_objection_handling?: number;
  weight_communication?: number;
  weight_product_knowledge?: number;
  weight_scientific_info?: number;
  pass_threshold?: number;
}

export interface ScenarioUpdate extends Partial<ScenarioCreate> {
  status?: Scenario["status"];
}
