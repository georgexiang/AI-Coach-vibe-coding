export type SessionMode =
  | "text"
  | "voice_pipeline"
  | "digital_human_pipeline"
  | "voice_realtime_model"
  | "digital_human_realtime_model"
  | "voice_realtime_agent"
  | "digital_human_realtime_agent";

export interface VoiceLiveToken {
  endpoint: string;
  token: string;
  auth_type?: "key" | "bearer"; // "key" for API key, "bearer" for STS bearer token
  region: string;
  model: string;
  avatar_enabled: boolean;
  avatar_character: string;
  voice_name: string;
  agent_id?: string;
  agent_version?: string;
  project_name?: string;
  // Per-HCP fields from token broker (D-08)
  avatar_style?: string;
  avatar_customized?: boolean;
  voice_type?: string;
  voice_temperature?: number;
  voice_custom?: boolean;
  turn_detection_type?: string;
  noise_suppression?: boolean;
  echo_cancellation?: boolean;
  eou_detection?: boolean;
  recognition_language?: string;
  agent_instructions_override?: string;
}

export interface VoiceLiveConfigStatus {
  voice_live_available: boolean;
  avatar_available: boolean;
  voice_name: string;
  avatar_character: string;
}

export interface VoiceLiveModelInfo {
  id: string;
  label: string;
  tier: string;
  description: string;
}

export interface VoiceLiveModelsResponse {
  models: VoiceLiveModelInfo[];
}

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type AudioState = "idle" | "listening" | "speaking" | "muted";

export interface TranscriptSegment {
  id: string;
  role: "user" | "assistant";
  content: string;
  isFinal: boolean;
  timestamp: number;
}

export interface VoiceLiveOptions {
  language: string;
  systemPrompt: string;
  onTranscript?: (segment: TranscriptSegment) => void;
  onConnectionStateChange?: (state: VoiceConnectionState) => void;
  onAudioStateChange?: (state: AudioState) => void;
  onError?: (error: Error) => void;
}

export interface VoiceLiveControls {
  connect: (
    tokenData: VoiceLiveToken,
  ) => Promise<{ session: unknown; iceServers: RTCIceServer[] }>;
  disconnect: () => Promise<void>;
  toggleMute: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  isMuted: boolean;
  connectionState: VoiceConnectionState;
  audioState: AudioState;
  sessionRef: React.MutableRefObject<unknown>;
  avatarSdpCallbackRef: React.MutableRefObject<
    ((serverSdp: string) => void) | null
  >;
}

export interface AvatarStreamControls {
  /** Start avatar WebRTC handshake. Sends SDP offer via VoiceLive session event. */
  connect: (
    iceServers: RTCIceServer[],
    sendSdpOffer: (sdp: string) => Promise<void>,
  ) => Promise<void>;
  /** Handle SDP answer from server (via onSessionAvatarConnecting handler). */
  handleServerSdp: (serverSdp: string) => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
}
