export const FEATURE_FLAGS = {
  avatarEnabled: import.meta.env.VITE_FEATURE_AVATAR === "true",
  voiceEnabled: import.meta.env.VITE_FEATURE_VOICE === "true",
} as const;
