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
}

export interface HcpProfileUpdate extends Partial<HcpProfileCreate> {}
