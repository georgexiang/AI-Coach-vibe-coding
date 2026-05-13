import type { SessionMessage, KeyMessageStatus, CoachingHint } from "./session";
import type { TranscriptSegment } from "./voice-live";

export type UnifiedSessionMode = "text" | "voice" | "digital_human";

export type VoiceConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnecting";

export interface ModeTransition {
  from: UnifiedSessionMode;
  to: UnifiedSessionMode;
  timestamp: number;
  reason?: "user_switch" | "mic_denied" | "fallback" | "initial";
}

export interface UnifiedSessionState {
  mode: UnifiedSessionMode;
  previousMode: UnifiedSessionMode | null;
  voiceConnectionState: VoiceConnectionState;
  messages: SessionMessage[];
  transcripts: TranscriptSegment[];
  keyMessagesStatus: KeyMessageStatus[];
  hints: CoachingHint[];
  isRecording: boolean;
  modeTransitions: ModeTransition[];
}

export interface GuidanceCard {
  id: string;
  messageKey: string;
  triggerCondition: "initial" | "first_mic" | "first_switch" | "session_end";
  dismissed: boolean;
}

export interface VoiceScoreStatus {
  session_id: string;
  voice_score_status:
    | "none"
    | "pending"
    | "processing"
    | "completed"
    | "failed";
  audio_url: string | null;
}

export interface VoiceScoreDimension {
  name: string;
  score: number;
  weight: number;
  max_score: number;
  feedback: string;
}

export interface VoiceScoreResult {
  dimensions: VoiceScoreDimension[];
  overall_voice_score: number;
}

export interface AudioUploadResponse {
  audio_url: string;
  voice_score_status: string;
}
