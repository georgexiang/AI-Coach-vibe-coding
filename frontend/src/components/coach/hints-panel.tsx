import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ScrollArea,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { MessageTracker } from "./message-tracker";
import type { CoachingHint, KeyMessageStatus } from "@/types/session";

interface SessionStats {
  duration: number;
  wordCount: number;
  messageCount: number;
}

interface HintsPanelProps {
  hints: CoachingHint[];
  keyMessagesStatus: KeyMessageStatus[];
  sessionStats: SessionStats;
  isCollapsed: boolean;
  onToggle: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function HintsPanel({
  hints,
  keyMessagesStatus,
  sessionStats,
  isCollapsed,
  onToggle,
}: HintsPanelProps) {
  const { t } = useTranslation("coach");

  if (isCollapsed) {
    return (
      <div className="flex w-12 flex-col items-center border-l border-slate-200 bg-slate-50 pt-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-expanded={false}
          aria-label={t("session.coachingPanel")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-[260px] flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
        <h2 className="text-sm font-semibold">{t("session.coachingPanel")}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-expanded={true}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto p-4">
        {/* AI Coach Hints */}
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("session.aiCoachHints")}</CardTitle>
          </CardHeader>
          <CardContent>
            {hints.length > 0 ? (
              <ul className="space-y-2">
                {hints.map((hint, idx) => (
                  <li
                    key={idx}
                    className="text-sm leading-relaxed text-slate-700"
                  >
                    {hint.content}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Hints will appear as you converse...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Message Tracker */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("session.messageTracker")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MessageTracker messages={keyMessagesStatus} />
          </CardContent>
        </Card>

        {/* Session Stats */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("session.sessionStats")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{t("session.duration")}</span>
              <span className="font-medium">
                {formatDuration(sessionStats.duration)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{t("session.wordCount")}</span>
              <span className="font-medium">{sessionStats.wordCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Messages</span>
              <span className="font-medium">{sessionStats.messageCount}</span>
            </div>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
