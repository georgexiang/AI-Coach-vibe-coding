import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyMessageStatus } from "@/types/session";

interface MessageTrackerProps {
  messages: KeyMessageStatus[];
}

export function MessageTracker({ messages }: MessageTrackerProps) {
  return (
    <div className="space-y-2">
      {messages.map((msg, idx) => {
        const isDelivered = msg.delivered;
        return (
          <div key={idx} className="flex items-center gap-2">
            {isDelivered ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-sm",
                isDelivered ? "text-green-700" : "text-muted-foreground"
              )}
            >
              {msg.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
