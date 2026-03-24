import { cn } from "@/lib/utils";
import type { SessionMessage } from "@/types/session";

interface ChatMessageProps {
  message: SessionMessage | { role: string; content: string };
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const timestamp =
    "created_at" in message ? message.created_at : undefined;

  return (
    <div
      className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
    >
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2.5",
          isAssistant
            ? "bg-blue-500 text-white"
            : "bg-slate-200 text-slate-900"
        )}
      >
        <p className="text-sm leading-relaxed">
          {message.content}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />
          )}
        </p>
        {timestamp && (
          <span className="mt-1 block text-sm opacity-70">
            {new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
