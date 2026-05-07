/**
 * Types for the unified training session page (Phase 23).
 * Merges text-mode and voice-mode concepts under one state machine.
 */
import type { CoachingHint, KeyMessageStatus, SessionMessage } from "./session";
import type { TranscriptSegment } from "./voice-live";

/** Simplified mode for the unified session UI (D-01) */
export type UnifiedSessionMode = "text" | "voice" | "digital_human";

/** Connection state for voice/digital human modes */
export type VoiceConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnecting";

/** Mode transition event */
export interface ModeTransition {
  from: UnifiedSessionMode;
  to: UnifiedSessionMode;
  timestamp: number;
  reason?: "user_switch" | "mic_denied" | "fallback" | "initial";
}

/** Unified session state (D-04: history preserved across mode switches) */
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

/** Guidance card state (D-07) */
export interface GuidanceCard {
  id: string;
  messageKey: string; // i18n key
  triggerCondition: "initial" | "first_mic" | "first_switch" | "session_end";
  dismissed: boolean;
}

/** Voice score status for polling (D-10) */
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

/** Voice score result with dimension scores (D-09) */
export interface VoiceScoreResult {
  dimensions: VoiceScoreDimension[];
  overall_voice_score: number;
}

export interface VoiceScoreDimension {
  name: string;
  score: number;
  weight: number;
  max_score: number;
  feedback: string;
}

/** Audio upload response */
export interface AudioUploadResponse {
  audio_url: string;
  voice_score_status: string;
}
