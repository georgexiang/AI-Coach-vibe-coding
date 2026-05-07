import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface UnifiedSessionLayoutProps {
  header: ReactNode;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  guidanceCards?: ReactNode;
  className?: string;
}

/**
 * Voice-dominant 2-panel full-screen layout container (D-02).
 * Left: 45% (avatar/waveform in voice, HCP info in text).
 * Right: 55% (chat transcript + hints).
 * Mobile: stacked layout.
 */
export function UnifiedSessionLayout({
  header,
  leftPanel,
  rightPanel,
  guidanceCards,
  className,
}: UnifiedSessionLayoutProps) {
  return (
    <div className={cn("flex h-screen flex-col bg-background", className)}>
      {header}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left panel: 45% on desktop, full width stacked on mobile */}
        <div className="flex w-full flex-col md:w-[45%] md:border-r">
          {leftPanel}
        </div>
        {/* Right panel: 55% on desktop */}
        <div className="hidden w-[55%] flex-col md:flex">
          {rightPanel}
        </div>
        {/* Guidance cards overlay */}
        {guidanceCards && (
          <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
            {guidanceCards}
          </div>
        )}
      </div>
    </div>
  );
}
