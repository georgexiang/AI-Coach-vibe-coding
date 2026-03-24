export interface FeatureFlags {
  avatar_enabled: boolean;
  voice_enabled: boolean;
  realtime_voice_enabled: boolean;
  conference_enabled: boolean;
  default_voice_mode: string;
  region: string;
}

export interface AppConfig {
  features: FeatureFlags;
  available_adapters: Record<string, string[]>;
}
