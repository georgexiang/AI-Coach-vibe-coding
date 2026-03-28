import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui";

interface LoadingStateProps {
  variant?: "spinner" | "card" | "table";
}

export function LoadingState({ variant = "spinner" }: LoadingStateProps) {
  const { t } = useTranslation("common");

  if (variant === "card") {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
            <Skeleton className="h-40 w-full" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-48" />
      <p className="text-muted-foreground text-sm">{t("loading")}</p>
    </div>
  );
}
