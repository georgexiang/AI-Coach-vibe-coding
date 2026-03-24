import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  sender: "hcp" | "mr";
  text: string;
  timestamp: Date;
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ChatBubble({ sender, text, timestamp }: ChatBubbleProps) {
  return (
    <div
      className={cn(
        "flex w-full",
        sender === "hcp" ? "justify-start" : "justify-end",
      )}
    >
      <div className="max-w-[75%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2",
            sender === "hcp"
              ? "rounded-tl-sm bg-primary text-primary-foreground"
              : "rounded-tr-sm bg-muted text-foreground",
          )}
        >
          <p className="whitespace-pre-wrap text-sm">{text}</p>
        </div>
        <p
          className={cn(
            "mt-1 text-xs text-muted-foreground",
            sender === "mr" && "text-right",
          )}
        >
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
