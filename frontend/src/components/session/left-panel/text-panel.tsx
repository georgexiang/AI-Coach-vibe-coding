import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { KeyMessages } from "@/components/coach/key-messages";
import type { KeyMessageStatus } from "@/types/session";

interface TextPanelProps {
  hcpName: string;
  hcpSpecialty: string;
  scenarioDescription: string;
  keyMessagesStatus: KeyMessageStatus[];
  className?: string;
}

/**
 * Left panel for text mode (D-03).
 * Shows HCP info, scenario description, and key messages checklist.
 */
export function TextPanel({
  hcpName,
  hcpSpecialty,
  scenarioDescription,
  keyMessagesStatus,
  className,
}: TextPanelProps) {
  const { t } = useTranslation("session");

  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-6 overflow-y-auto p-6",
        className,
      )}
    >
      {/* HCP Info */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
          {hcpName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground">{hcpName}</h3>
          <p className="text-xs text-muted-foreground">{hcpSpecialty}</p>
        </div>
      </div>

      {/* Scenario Description */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          {t("session.textPanel.scenario")}
        </h4>
        <p className="text-sm leading-relaxed text-foreground/80">
          {scenarioDescription}
        </p>
      </div>

      {/* Key Messages */}
      <div>
        <h4 className="mb-3 text-xs font-medium uppercase text-muted-foreground">
          {t("session.textPanel.keyMessages")}
        </h4>
        <KeyMessages messages={keyMessagesStatus} />
      </div>
    </div>
  );
}
