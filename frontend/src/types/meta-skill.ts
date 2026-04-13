export interface MetaSkillResource {
  id: string;
  resource_type: string;
  filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface MetaSkill {
  id: string;
  name: string;
  display_name: string;
  skill_type: string;
  agent_id: string;
  agent_version: string;
  model: string;
  template_content: string;
  template_language: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
