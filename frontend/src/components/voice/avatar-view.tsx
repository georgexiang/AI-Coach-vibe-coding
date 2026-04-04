import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";
import { AudioOrb } from "./audio-orb";
import type { AudioState } from "@/types/voice-live";

interface AvatarViewProps {
  videoRef: Ref<HTMLVideoElement>;
  isAvatarConnected: boolean;
  audioState: AudioState;
  analyserData: Uint8Array | null;
  isConnecting: boolean;
  hcpName: string;
  isFullScreen: boolean;
  className?: string;
}

/**
 * Avatar video display with audio orb fallback.
 *
 * Renders a pre-existing <video> element that is ALWAYS in the DOM so WebRTC
 * ontrack can assign srcObject regardless of visibility state. This matches the
 * Azure reference implementation (VideoPanel.tsx) pattern.
 *
 * Uses absolute positioning layers instead of display:none (hidden) to avoid
 * browser autoplay restrictions on invisible video elements.
 *
 * When avatar is connected, the video layer is visible and overlays the orb.
 * When voice-only, AudioOrb renders as the pulsating sphere fallback.
 */
export function AvatarView({
  videoRef,
  isAvatarConnected,
  audioState,
  analyserData: _analyserData,
  isConnecting,
  hcpName,
  isFullScreen,
  className,
}: AvatarViewProps) {
  const { t } = useTranslation("voice");

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-slate-900",
        isFullScreen ? "h-[calc(100vh-64px-80px)]" : "h-[280px]",
        className,
      )}
      role="region"
      aria-label={t("title")}
    >
      {/*
       * Pre-rendered <video> element — always in DOM so WebRTC ontrack can
       * set srcObject at any time. Visibility controlled via opacity + z-index,
       * NOT display:none, to avoid browser autoplay restrictions.
       * Matches Azure reference implementation VideoPanel.tsx pattern.
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
          <Skeleton className="h-20 w-20 rounded-full" />
          <p className="text-sm text-white/70">{t("connectingAvatar")}</p>
        </div>
      )}

      {/* Fallback: audio orb when avatar is not connected and not loading */}
      {!isConnecting && !isAvatarConnected && (
        <AudioOrb audioState={audioState} />
      )}

      {/* HCP name badge at bottom */}
      {hcpName && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/60 to-transparent px-4 py-2">
          <p className="text-center text-sm font-medium text-white">
            {hcpName}
          </p>
        </div>
      )}
    </div>
  );
}
