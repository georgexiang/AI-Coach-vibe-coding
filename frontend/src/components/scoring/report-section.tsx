import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ImprovementSuggestion } from "@/types/report";

interface ReportSectionProps {
  improvements: ImprovementSuggestion[];
  keyMessagesDelivered: number;
  keyMessagesTotal: number;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function ReportSection({
  improvements,
  keyMessagesDelivered,
  keyMessagesTotal,
}: ReportSectionProps) {
  const { t } = useTranslation("scoring");

  const grouped = improvements.reduce<
    Record<string, ImprovementSuggestion[]>
  >((acc, item) => {
    const key = item.priority;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  const sortedPriorities = Object.keys(grouped).sort(
    (a, b) => (PRIORITY_ORDER[a] ?? 3) - (PRIORITY_ORDER[b] ?? 3),
  );

  const priorityLabels: Record<string, string> = {
    high: t("report.highPriority"),
    medium: t("report.mediumPriority"),
    low: t("report.lowPriority"),
  };

  return (
    <div className="space-y-6">
      {/* Key message delivery */}
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <span className="text-sm font-medium">{t("report.keyMessages")}:</span>
        <span className="text-lg font-semibold">
          {keyMessagesDelivered}/{keyMessagesTotal}
        </span>
        <div className="ml-auto h-2 w-32 overflow-hidden rounded-full bg-accent">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              keyMessagesTotal > 0 &&
                keyMessagesDelivered / keyMessagesTotal >= 0.7
                ? "bg-green-500"
                : "bg-orange-500",
            )}
            style={{
              width: `${keyMessagesTotal > 0 ? (keyMessagesDelivered / keyMessagesTotal) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Improvements grouped by priority */}
      {sortedPriorities.map((priority) => {
        const items = grouped[priority];
        if (!items || items.length === 0) return null;
        return (
          <div key={priority} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "text-xs",
                  PRIORITY_STYLES[priority] ?? "",
                )}
              >
                {priorityLabels[priority] ?? priority}
              </Badge>
              <span className="text-sm text-muted-foreground">
                ({items.length})
              </span>
            </div>
            <ul className="space-y-2 pl-1">
              {items.map((item, idx) => (
                <li key={idx} className="rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.dimension}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{item.suggestion}</p>
                  {item.example && (
                    <p className="mt-1 text-sm italic text-muted-foreground">
                      &ldquo;{item.example}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {improvements.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No improvement suggestions at this time.
        </p>
      )}
    </div>
  );
}
