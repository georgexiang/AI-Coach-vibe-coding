import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui";

export function LoadingState() {
  const { t } = useTranslation("common");

  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-48" />
      <p className="text-muted-foreground text-sm">{t("loading")}</p>
    </div>
  );
}
