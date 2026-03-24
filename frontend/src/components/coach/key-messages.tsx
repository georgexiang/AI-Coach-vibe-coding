import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyMessageStatus } from "@/types/session";

interface KeyMessagesProps {
  messages: KeyMessageStatus[];
}

export function KeyMessages({ messages }: KeyMessagesProps) {
  return (
    <div className="space-y-2.5">
      {messages.map((msg, idx) => (
        <div key={idx} className="flex items-start gap-2">
          {msg.delivered ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span
            className={cn(
              "cursor-pointer text-sm leading-relaxed",
              msg.delivered
                ? "text-green-700 line-through"
                : "text-slate-700"
            )}
          >
            {msg.message}
          </span>
        </div>
      ))}
    </div>
  );
}
