import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-muted/50 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground">
        {title ?? t("emptyState.title")}
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        {body ?? t("emptyState.body")}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
