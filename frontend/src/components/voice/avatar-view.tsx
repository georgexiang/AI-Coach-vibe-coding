import { useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";
import { AudioOrb } from "./audio-orb";
import { AVATAR_CHARACTER_MAP, getAvatarInitials } from "@/data/avatar-characters";
import type { AudioState } from "@/types/voice-live";

const CDN_BASE =
  "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/media";

interface AvatarViewProps {
  videoRef: Ref<HTMLVideoElement>;
  /** Whether the avatar WebRTC video stream is actually connected. */
  isAvatarConnected: boolean;
  /**
   * Whether a voice session is active (connected).
   * Distinct from isAvatarConnected — a voice-only session has isSessionActive=true
   * but isAvatarConnected=false. When provided, AudioOrb renders during voice-only
   * sessions instead of the static preview.
   * Falls back to isAvatarConnected when not provided (backwards-compatible).
   */
  isSessionActive?: boolean;
  audioState: AudioState;
  /** Normalised volume level 0–1 for AudioOrb pulsation. */
  volumeLevel?: number;
  isConnecting: boolean;
  isDigitalHumanMode?: boolean;
  hcpName: string;
  isFullScreen: boolean;
  /** Azure TTS Avatar character ID (e.g. "lisa", "lori"). */
  avatarCharacter?: string;
  /** Azure TTS Avatar style (e.g. "graceful-standing", "casual-sitting"). */
  avatarStyle?: string;
  videoFit?: "cover" | "contain";
  className?: string;
}

/**
 * Avatar video display with static preview + audio orb fallback.
 *
 * Renders layers in order:
 * 1. WebRTC <video> — always in DOM, visible when avatar stream is connected
 * 2. Static avatar thumbnail — shown before session starts (from Azure CDN)
 * 3. AudioOrb — shown during voice-only mode (no avatar)
 * 4. Skeleton — shown while WebRTC is negotiating
 *
 * Matches AI Foundry's center-panel avatar display pattern.
 */
export function AvatarView({
  videoRef,
  isAvatarConnected,
  isSessionActive: isSessionActiveProp,
  audioState,
  volumeLevel,
  isConnecting,
  isDigitalHumanMode = true,
  hcpName,
  isFullScreen,
  avatarCharacter,
  avatarStyle,
  videoFit = "cover",
  className,
}: AvatarViewProps) {
  const { t } = useTranslation("voice");
  const [imgError, setImgError] = useState(false);

  // Backwards-compatible: if isSessionActive is not provided, fall back to isAvatarConnected
  const isSessionActive = isSessionActiveProp ?? isAvatarConnected;

  // Lookup character metadata for thumbnail
  const charMeta = avatarCharacter
    ? AVATAR_CHARACTER_MAP.get(avatarCharacter)
    : undefined;
  const resolvedAvatarStyle = charMeta?.isPhotoAvatar
    ? ""
    : avatarStyle && charMeta?.styles.includes(avatarStyle)
      ? avatarStyle
      : charMeta?.defaultStyle;

  // Build style-specific thumbnail URL for video avatars
  const thumbnailUrl = charMeta
    ? charMeta.isPhotoAvatar
      ? charMeta.thumbnailUrl
      : resolvedAvatarStyle
        ? `${CDN_BASE}/${charMeta.id}-${resolvedAvatarStyle}.png`
        : charMeta.thumbnailUrl
    : undefined;

  const showDigitalHumanPreview = Boolean(
    isDigitalHumanMode && !isAvatarConnected && !isConnecting && charMeta && !imgError,
  );
  const showAvatarFallback = Boolean(
    isDigitalHumanMode && !isAvatarConnected && !isConnecting && imgError && charMeta,
  );
  const isAvatarSpeaking = audioState === "speaking";
  const isAvatarListening = audioState === "listening";

  // Show audio orb when: not connecting, avatar stream is NOT connected, AND
  // either avatar is disabled/no character is configured, or the current mode is voice-only.
  const showAudioOrb = !isConnecting && !isAvatarConnected &&
    (!isDigitalHumanMode || !charMeta);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        isAvatarConnected
          ? "bg-gradient-to-b from-slate-100 to-slate-200"
          : "bg-gradient-to-b from-slate-50 to-slate-100",
        isFullScreen ? "h-[calc(100vh-64px-80px)]" : "min-h-[360px]",
        className,
      )}
      role="region"
      aria-label={t("title")}
    >
      {/*
       * Pre-rendered <video> element — always in DOM so WebRTC ontrack can
       * set srcObject at any time. Visibility controlled via opacity + z-index,
       * NOT display:none, to avoid browser autoplay restrictions.
       */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-300",
          videoFit === "contain" ? "object-contain" : "object-cover",
          isAvatarConnected && !isConnecting ? "z-10 opacity-100" : "z-0 opacity-0",
        )}
        data-testid="avatar-video"
      />

      {/* Loading state: skeleton while WebRTC is negotiating */}
      {isConnecting && (
        <div className="z-20 flex flex-col items-center gap-3">
          <Skeleton className="h-32 w-32 rounded-full" />
          <p className="text-sm text-muted-foreground">
            {t(isDigitalHumanMode ? "connectingAvatar" : "connectingVoice")}
          </p>
        </div>
      )}

      {/* Static digital-human preview — remains visible until real WebRTC video arrives */}
      {showDigitalHumanPreview && (
        <div
          className="z-5 absolute inset-0 flex flex-col items-center justify-end"
          data-testid="avatar-static-preview"
          data-audio-state={audioState}
        >
          {isSessionActive && (isAvatarSpeaking || isAvatarListening) && (
            <div
              className={cn(
                "absolute inset-x-8 bottom-14 h-24 rounded-full blur-2xl transition-opacity duration-300",
                isAvatarSpeaking
                  ? "bg-primary/25 opacity-100"
                  : "bg-sky-300/20 opacity-80",
              )}
              aria-hidden="true"
            />
          )}
          <img
            src={thumbnailUrl}
            alt={charMeta!.displayName}
            className={cn(
              "relative max-h-[85%] w-auto object-contain drop-shadow-lg transition-transform duration-300",
              isAvatarSpeaking && "scale-[1.02] drop-shadow-2xl",
              isAvatarListening && "scale-[1.01]",
            )}
            onError={() => setImgError(true)}
          />
          <p className="relative py-2 text-sm font-medium text-foreground/70">
            {charMeta!.displayName}
          </p>
        </div>
      )}

      {/* Fallback: gradient circle with initials if image fails */}
      {showAvatarFallback && (
        <div className="z-5 flex flex-col items-center gap-3">
          <div
            className={cn(
              "flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br shadow-xl transition-transform duration-300",
              isAvatarSpeaking && "scale-105",
              charMeta!.gradientClasses,
            )}
          >
            <span className="text-5xl font-bold text-white">
              {getAvatarInitials(charMeta!.displayName)}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground/70">
            {charMeta!.displayName}
          </p>
        </div>
      )}

      {/* Audio orb: voice-only mode (no avatar stream) or idle with no avatar character */}
      {showAudioOrb && (
        <AudioOrb audioState={audioState} volumeLevel={volumeLevel} />
      )}

      {/* HCP name badge at bottom */}
      {hcpName && (isAvatarConnected || showDigitalHumanPreview || showAvatarFallback) && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/40 to-transparent px-4 py-3">
          <p className="text-center text-sm font-medium text-white">
            {hcpName}
          </p>
        </div>
      )}
    </div>
  );
}
