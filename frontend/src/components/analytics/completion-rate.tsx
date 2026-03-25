import { useTranslation } from "react-i18next";

interface CompletionRateProps {
  rate: number;
  totalUsers: number;
  activeUsers: number;
}

export function CompletionRate({ rate, totalUsers, activeUsers }: CompletionRateProps) {
  const { t } = useTranslation("analytics");

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold">{rate}%</span>
        <span className="text-sm text-muted-foreground">
          {activeUsers} / {totalUsers} {t("activeUsers").toLowerCase()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}
