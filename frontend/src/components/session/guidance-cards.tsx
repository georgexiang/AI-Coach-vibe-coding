import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedSessionMode, ModeTransition } from "@/types/unified-session";

interface GuidanceCardsProps {
  mode: UnifiedSessionMode;
  isConnected: boolean;
  modeTransitions: ModeTransition[];
  sessionId: string;
}

interface CardConfig {
  id: string;
  messageKey: string;
  show: (props: GuidanceCardsProps) => boolean;
}

const CARD_CONFIGS: CardConfig[] = [
  {
    id: "start-talking",
    messageKey: "session.guidance.startTalking",
    show: ({ mode, isConnected }) =>
      (mode === "voice" || mode === "digital_human") && isConnected,
  },
  {
    id: "switch-modes",
    messageKey: "session.guidance.switchModes",
    show: ({ modeTransitions }) => modeTransitions.length === 0,
  },
  {
    id: "end-session",
    messageKey: "session.guidance.endSession",
    show: ({ modeTransitions }) => modeTransitions.length >= 2,
  },
];

const AUTO_DISMISS_MS = 10000;

/**
 * Inline guidance prompt cards that appear at key moments (D-07).
 * Dismissed state stored in localStorage per session.
 * Auto-dismiss after 10 seconds.
 */
export function GuidanceCards(props: GuidanceCardsProps) {
  const { t } = useTranslation("session");
  const { sessionId } = props;
  const storageKey = `guidance-dismissed-${sessionId}`;

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const dismissCard = useCallback(
    (cardId: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [storageKey],
  );

  // Auto-dismiss visible cards after timeout
  const visibleCards = CARD_CONFIGS.filter(
    (c) => !dismissed.has(c.id) && c.show(props),
  );

  useEffect(() => {
    if (visibleCards.length === 0) return;
    const timers = visibleCards.map((card) =>
      setTimeout(() => dismissCard(card.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [visibleCards, dismissCard]);

  if (visibleCards.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visibleCards.map((card) => (
        <div
          key={card.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-card px-4 py-3",
            "shadow-md animate-in fade-in slide-in-from-bottom-2",
          )}
          data-testid={`guidance-card-${card.id}`}
        >
          <span className="text-sm text-muted-foreground">
            {t(card.messageKey)}
          </span>
          <button
            type="button"
            onClick={() => dismissCard(card.id)}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("session.guidance.dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
