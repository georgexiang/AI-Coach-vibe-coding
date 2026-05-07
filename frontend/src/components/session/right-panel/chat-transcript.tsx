import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ScrollArea, Textarea } from "@/components/ui";
import { ChatMessage } from "@/components/coach/chat-message";
import { TypingIndicator } from "@/components/coach/typing-indicator";
import type { SessionMessage } from "@/types/session";
import type { UnifiedSessionMode } from "@/types/unified-session";
import { useState, useCallback } from "react";

interface ChatTranscriptProps {
  messages: SessionMessage[];
  isStreaming: boolean;
  streamingText?: string;
  inputMode: UnifiedSessionMode;
  onSendTextMessage?: (text: string) => void;
  className?: string;
}

/**
 * Unified conversation display for both text and voice modes (D-04).
 * Auto-scrolls to bottom on new messages.
 * Shows text input bar only in text mode.
 */
export function ChatTranscript({
  messages,
  isStreaming,
  streamingText = "",
  inputMode,
  onSendTextMessage,
  className,
}: ChatTranscriptProps) {
  const { t } = useTranslation("session");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");

  // Auto-scroll to bottom on new message
  useEffect(() => {
    const el = scrollRef.current;
    if (el?.scrollTo) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, streamingText]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || !onSendTextMessage) return;
    onSendTextMessage(trimmed);
    setInputText("");
  }, [inputText, onSendTextMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className={cn("flex flex-1 flex-col", className)}>
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingText && (
            <ChatMessage
              message={{
                id: "__streaming",
                session_id: "",
                role: "assistant",
                content: streamingText,
                message_index: -1,
                created_at: new Date().toISOString(),
              }}
            />
          )}
          {isStreaming && !streamingText && <TypingIndicator />}
        </div>
      </ScrollArea>

      {/* Text input bar — only shown in text mode */}
      {inputMode === "text" && onSendTextMessage && (
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
              data-testid="chat-input"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              data-testid="send-btn"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
