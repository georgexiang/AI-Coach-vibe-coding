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
  hcpName: string;
  isFullScreen: boolean;
  /** Azure TTS Avatar character ID (e.g. "lisa", "lori"). */
  avatarCharacter?: string;
  /** Azure TTS Avatar style (e.g. "graceful-standing", "casual-sitting"). */
  avatarStyle?: string;
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
  hcpName,
  isFullScreen,
  avatarCharacter,
  avatarStyle,
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

  // Build style-specific thumbnail URL for video avatars
  const thumbnailUrl = charMeta
    ? charMeta.isPhotoAvatar
      ? charMeta.thumbnailUrl
      : avatarStyle
        ? `${CDN_BASE}/${charMeta.id}-${avatarStyle}.png`
        : charMeta.thumbnailUrl
    : undefined;

  // Show static preview when: no active session, not connecting, and we have a thumbnail
  const showStaticPreview = !isSessionActive && !isAvatarConnected && !isConnecting && charMeta && !imgError;

  // Show audio orb when: not connecting, avatar stream is NOT connected, AND
  // either (a) no avatar character configured, or (b) session is active but avatar stream didn't connect
  const showAudioOrb = !isConnecting && !isAvatarConnected &&
    (!charMeta || (isSessionActive && !isAvatarConnected));

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
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          isAvatarConnected && !isConnecting ? "z-10 opacity-100" : "z-0 opacity-0",
        )}
        data-testid="avatar-video"
      />

      {/* Loading state: skeleton while WebRTC is negotiating */}
      {isConnecting && (
        <div className="z-20 flex flex-col items-center gap-3">
          <Skeleton className="h-32 w-32 rounded-full" />
          <p className="text-sm text-muted-foreground">{t("connectingAvatar")}</p>
        </div>
      )}

      {/* Static avatar preview — large image matching AI Foundry Playground */}
      {showStaticPreview && (
        <div
          className="z-5 flex flex-col items-center justify-end absolute inset-0"
          data-testid="avatar-static-preview"
        >
          <img
            src={thumbnailUrl}
            alt={charMeta.displayName}
            className="max-h-[85%] w-auto object-contain drop-shadow-lg"
            onError={() => setImgError(true)}
          />
          <p className="py-2 text-sm font-medium text-foreground/70">
            {charMeta.displayName}
          </p>
        </div>
      )}

      {/* Fallback: gradient circle with initials if image fails */}
      {!isSessionActive && !isAvatarConnected && !isConnecting && imgError && charMeta && (
        <div className="z-5 flex flex-col items-center gap-3">
          <div
            className={cn(
              "flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br shadow-xl",
              charMeta.gradientClasses,
            )}
          >
            <span className="text-5xl font-bold text-white">
              {getAvatarInitials(charMeta.displayName)}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground/70">
            {charMeta.displayName}
          </p>
        </div>
      )}

      {/* Audio orb: voice-only mode (no avatar stream) or idle with no avatar character */}
      {showAudioOrb && (
        <AudioOrb audioState={audioState} volumeLevel={volumeLevel} />
      )}

      {/* HCP name badge at bottom */}
      {hcpName && isAvatarConnected && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/40 to-transparent px-4 py-3">
          <p className="text-center text-sm font-medium text-white">
            {hcpName}
          </p>
        </div>
      )}
    </div>
  );
}
