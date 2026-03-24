import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "delivered" | "in-progress" | "pending";
  label: string;
}

const dotColorMap: Record<StatusBadgeProps["status"], string> = {
  delivered: "bg-strength",
  "in-progress": "bg-weakness",
  pending: "bg-muted-foreground",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dotColorMap[status])} />
      <span className="text-sm text-foreground">{label}</span>
    </span>
  );
}
