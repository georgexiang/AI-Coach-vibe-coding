import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SkillStatus } from "@/types/skill";

interface SkillStatusBadgeProps {
  status: SkillStatus;
  className?: string;
}

const dotColorMap: Record<SkillStatus, string> = {
  draft: "bg-muted-foreground",
  review: "bg-weakness",
  published: "bg-strength",
  archived: "bg-muted-foreground",
  failed: "bg-destructive",
};

const badgeStyleMap: Record<SkillStatus, string> = {
  draft: "",
  review: "",
  published: "border-transparent bg-primary/10 text-primary",
  archived: "",
  failed: "",
};

const badgeVariantMap: Record<
  SkillStatus,
  "outline" | "destructive" | "default"
> = {
  draft: "outline",
  review: "outline",
  published: "outline",
  archived: "outline",
  failed: "destructive",
};

export function SkillStatusBadge({ status, className }: SkillStatusBadgeProps) {
  const { t } = useTranslation("skill");

  const label = t(`status.${status}`);

  return (
    <Badge
      variant={badgeVariantMap[status]}
      className={cn(badgeStyleMap[status], className)}
      aria-label={label}
    >
      <span className={cn("size-2 shrink-0 rounded-full", dotColorMap[status])} />
      {label}
    </Badge>
  );
}
