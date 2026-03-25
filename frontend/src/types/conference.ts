export type AudienceHcpStatus = "listening" | "hand-raised" | "speaking" | "idle";
export type ConferenceSubState = "presenting" | "qa" | "";

export interface AudienceHcp {
  id: string;
  scenarioId: string;
  hcpProfileId: string;
  hcpName: string;
  hcpSpecialty: string;
  roleInConference: string;
  voiceId: string;
  sortOrder: number;
  status: AudienceHcpStatus; // client-side only
}

export interface AudienceHcpCreate {
  hcpProfileId: string;
  roleInConference?: string;
  voiceId?: string;
  sortOrder?: number;
}

export interface ConferenceSession {
  id: string;
  userId: string;
  scenarioId: string;
  status: string;
  sessionType: "conference";
  subState: ConferenceSubState;
  presentationTopic: string | null;
  audienceConfig: string | null;
  keyMessagesStatus: string | null;
  createdAt: string | null;
}

export interface QueuedQuestion {
  hcpProfileId: string;
  hcpName: string;
  question: string;
  relevanceScore: number;
  status: "waiting" | "active" | "answered";
}

export interface TranscriptLine {
  speaker: string;
  speakerId?: string;
  text: string;
  timestamp: Date;
}

export interface SpeakerTextEvent {
  speaker_id: string;
  speaker_name: string;
  content: string;
}

export interface TurnChangeEvent {
  speaker_id: string;
  speaker_name: string;
  action: "asking" | "listening";
}

export interface SubStateEvent {
  sub_state: ConferenceSubState;
  message: string;
}
