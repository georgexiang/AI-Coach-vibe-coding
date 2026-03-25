import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ConferenceSubState } from "@/types/conference";

interface SubStateBadgeProps {
  subState: ConferenceSubState;
}

export function SubStateBadge({ subState }: SubStateBadgeProps) {
  const { t } = useTranslation("conference");

  if (!subState) return null;

  const label =
    subState === "presenting"
      ? t("subState.presenting")
      : t("subState.qa");

  return (
    <Badge
      aria-live="assertive"
      className={cn(
        "text-xs font-medium uppercase",
        subState === "presenting"
          ? "bg-primary/10 text-primary hover:bg-primary/10"
          : "bg-orange-100 text-orange-600 hover:bg-orange-100",
      )}
    >
      {label}
    </Badge>
  );
}
