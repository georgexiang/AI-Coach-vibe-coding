export interface HcpProfile {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  title: string;
  avatar_url: string;
  personality_type: "friendly" | "skeptical" | "busy" | "analytical" | "cautious";
  emotional_state: number; // 0-100
  communication_style: number; // 0-100
  expertise_areas: string[];
  prescribing_habits: string;
  concerns: string;
  objections: string[];
  probe_topics: string[];
  difficulty: "easy" | "medium" | "hard";
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  agent_id: string;
  agent_version: string;
  agent_sync_status: "synced" | "pending" | "failed" | "none";
  agent_sync_error: string;
  // Voice Live Instance reference
  voice_live_instance_id: string | null;
  // Voice Live agent metadata toggle
  voice_live_enabled: boolean;
  // Voice Live model selection (Phase 13)
  voice_live_model: string;
  // Voice settings (D-01)
  voice_name: string;
  voice_type: string;
  voice_temperature: number;
  voice_custom: boolean;
  // Avatar settings (D-03)
  avatar_character: string;
  avatar_style: string;
  avatar_customized: boolean;
  // Conversation parameters (D-01)
  turn_detection_type: string;
  noise_suppression: boolean;
  echo_cancellation: boolean;
  eou_detection: boolean;
  recognition_language: string;
  // Agent override (D-02)
  agent_instructions_override: string;
}

export interface HcpProfileCreate {
  name: string;
  specialty: string;
  hospital?: string;
  title?: string;
  avatar_url?: string;
  personality_type?: HcpProfile["personality_type"];
  emotional_state?: number;
  communication_style?: number;
  expertise_areas?: string[];
  prescribing_habits?: string;
  concerns?: string;
  objections?: string[];
  probe_topics?: string[];
  difficulty?: HcpProfile["difficulty"];
  voice_live_instance_id?: string | null;
  voice_live_enabled?: boolean;
  voice_live_model?: string;
  voice_name?: string;
  voice_type?: string;
  voice_temperature?: number;
  voice_custom?: boolean;
  avatar_character?: string;
  avatar_style?: string;
  avatar_customized?: boolean;
  turn_detection_type?: string;
  noise_suppression?: boolean;
  echo_cancellation?: boolean;
  eou_detection?: boolean;
  recognition_language?: string;
  agent_instructions_override?: string;
}

export interface HcpProfileUpdate extends Partial<HcpProfileCreate> {}
