export type SessionStatus = "created" | "in_progress" | "completed" | "scored";

export interface CoachingSession {
  id: string;
  scenario_id: string;
  user_id: string;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface KeyMessageStatus {
  message: string;
  delivered: boolean;
  detected_at: string | null;
}

export interface CoachingHint {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageRequest {
  session_id: string;
  content: string;
}

export type SSEEventType = "text" | "hint" | "key_messages" | "done" | "error";

export interface SSEEvent {
  event: SSEEventType;
  data: string;
}
