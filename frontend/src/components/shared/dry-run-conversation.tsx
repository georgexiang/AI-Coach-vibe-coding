import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChatBubble } from "@/components/shared/chat-bubble";
import { cn } from "@/lib/utils";
import type { DryRunMessage } from "@/types/dry-run";

interface DryRunConversationProps {
  messages: DryRunMessage[];
}

export function DryRunConversation({ messages }: DryRunConversationProps) {
  const { t } = useTranslation("skill");

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">
          {t("dryRun.noConversationData", {
            defaultValue: "No conversation data available",
          })}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[calc(100vh-320px)]">
      <div
        role="log"
        aria-label={t("dryRun.tabConversation", {
          defaultValue: "Conversation",
        })}
        className="space-y-4 p-4"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2">
            <div className="flex-1">
              <ChatBubble
                sender={msg.role}
                text={msg.content}
                timestamp={new Date(msg.created_at)}
                speakerName={
                  msg.role === "mr"
                    ? t("dryRun.speakerMr", { defaultValue: "AI-MR" })
                    : t("dryRun.speakerHcp", { defaultValue: "AI-HCP" })
                }
                speakerColor={msg.role === "mr" ? "#A855F7" : "#1E40AF"}
              />
            </div>
            {msg.sop_step_id && msg.sop_step_name && (
              <Badge
                variant="outline"
                className={cn("mt-6 shrink-0 text-xs")}
              >
                {msg.sop_step_name}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
