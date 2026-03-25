import { Avatar, AvatarFallback, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { QueuedQuestion } from "@/types/conference";

interface QuestionItemProps {
  question: QueuedQuestion;
  onRespond: (hcpId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function QuestionItem({ question, onRespond }: QuestionItemProps) {
  const { t } = useTranslation("conference");
  const initials = getInitials(question.hcpName);

  return (
    <div
      className={cn(
        "flex h-[72px] items-center gap-3 px-4",
        question.status === "active" && "border-l-2 border-primary bg-primary/5",
        question.status === "answered" && "opacity-50",
      )}
    >
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="shrink-0 text-sm font-medium text-foreground">
        {question.hcpName}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-muted-foreground",
          question.status === "answered" && "line-through",
        )}
      >
        {question.question}
      </span>
      <Button
        size="sm"
        onClick={() => onRespond(question.hcpProfileId)}
        disabled={question.status === "active" || question.status === "answered"}
        className="shrink-0"
      >
        {question.status === "active" ? t("respond") + "..." : t("respond")}
      </Button>
    </div>
  );
}
