import type { HcpProfile } from "./hcp";

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tags: string[];
  mode: "f2f" | "conference";
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "active" | "archived";
  hcp_profile_id: string;
  hcp_profile?: HcpProfile;
  key_messages: string[];
  skill_id: string;
  skill_version_id: string | null;
  rubric_id: string;
  pass_threshold: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScenarioCreate {
  name: string;
  tags?: string[];
  hcp_profile_id: string;
  skill_id: string;
  rubric_id: string;
  description?: string;
  mode?: Scenario["mode"];
  difficulty?: Scenario["difficulty"];
  key_messages?: string[];
  pass_threshold?: number;
}

export interface ScenarioUpdate {
  name?: string;
  tags?: string[];
  hcp_profile_id?: string;
  skill_id?: string;
  rubric_id?: string;
  description?: string;
  mode?: Scenario["mode"];
  difficulty?: Scenario["difficulty"];
  key_messages?: string[];
  pass_threshold?: number;
}
