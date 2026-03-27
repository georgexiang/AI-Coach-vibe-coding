import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui";
import { WaveformViz } from "./waveform-viz";
import type { AudioState } from "@/types/voice-live";

interface AvatarViewProps {
  videoContainerRef: Ref<HTMLDivElement>;
  isAvatarConnected: boolean;
  audioState: AudioState;
  analyserData: Uint8Array | null;
  isConnecting: boolean;
  hcpName: string;
  isFullScreen: boolean;
  className?: string;
}

/**
 * Avatar video container with waveform fallback.
 * When avatar is connected, renders the WebRTC video container.
 * When voice-only, renders WaveformViz as fallback (D-06).
 */
export function AvatarView({
  videoContainerRef,
  isAvatarConnected,
  audioState,
  analyserData,
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
      {isConnecting && (
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-20 w-20 rounded-full" />
          <p className="text-sm text-white/70">{t("connectingAvatar")}</p>
        </div>
      )}

      {!isConnecting && isAvatarConnected && (
        <div
          ref={videoContainerRef}
          className="h-full w-full"
          data-testid="avatar-video-container"
        />
      )}

      {!isConnecting && !isAvatarConnected && (
        <WaveformViz
          audioState={audioState}
          analyserData={analyserData}
          className="w-full rounded-none"
        />
      )}

      {hcpName && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-2">
          <p className="text-center text-sm font-medium text-white">
            {hcpName}
          </p>
        </div>
      )}
    </div>
  );
}
