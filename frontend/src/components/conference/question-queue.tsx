import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui";
import { QuestionItem } from "./question-item";
import type { QueuedQuestion } from "@/types/conference";

interface QuestionQueueProps {
  questions: QueuedQuestion[];
  onRespondTo: (hcpId: string) => void;
}

export function QuestionQueue({ questions, onRespondTo }: QuestionQueueProps) {
  const { t } = useTranslation("conference");

  if (questions.length === 0) return null;

  return (
    <section
      role="region"
      aria-live="polite"
      aria-label={t("questionQueue")}
      className="max-h-[160px] border-t"
    >
      <div className="px-4 pt-2 pb-1">
        <h3 className="text-sm font-medium text-foreground">
          {t("questionQueue")}
        </h3>
      </div>
      <ScrollArea className="max-h-[130px]">
        <div className="flex flex-col">
          {questions.map((q) => (
            <QuestionItem
              key={q.hcpProfileId + q.question}
              question={q}
              onRespond={onRespondTo}
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
