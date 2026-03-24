import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Send, Mic } from "lucide-react";
import {
  ScrollArea,
  Button,
  Avatar,
  AvatarFallback,
  Switch,
  Textarea,
} from "@/components/ui";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { SessionTimer } from "./session-timer";
import type { SessionMessage, SessionStatus } from "@/types/session";

interface ChatAreaProps {
  sessionId: string;
  messages: SessionMessage[];
  onSendMessage: (msg: string) => void;
  isStreaming: boolean;
  streamingText: string;
  onEndSession: () => void;
  sessionStatus: SessionStatus;
  startedAt?: string | null;
  hcpInitials?: string;
}

export function ChatArea({
  sessionId: _sessionId,
  messages,
  onSendMessage,
  isStreaming,
  streamingText,
  onEndSession,
  sessionStatus,
  startedAt,
  hcpInitials = "HC",
}: ChatAreaProps) {
  const { t } = useTranslation("coach");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [avatarEnabled, setAvatarEnabled] = useState(true);

  const isActive =
    sessionStatus === "in_progress" || sessionStatus === "created";

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, isStreaming]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage(trimmed);
    setInputText("");
  }, [inputText, isStreaming, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
        <SessionTimer startedAt={startedAt ?? null} />
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndSession}
          disabled={!isActive}
        >
          <AlertCircle className="mr-1 h-4 w-4" />
          {t("session.endSession")}
        </Button>
      </div>

      {/* Avatar display area */}
      <div className="relative flex h-[240px] items-center justify-center bg-slate-900">
        {avatarEnabled && (
          <Avatar className="h-32 w-32 border-4 border-white">
            <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
              {hcpInitials}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded bg-slate-800/80 px-3 py-1.5">
          <span className="text-sm text-white">Avatar</span>
          <Switch checked={avatarEnabled} onCheckedChange={setAvatarEnabled} />
        </div>
      </div>

      {/* Chat messages */}
      <ScrollArea className="flex-1 p-6">
        <div
          className="mx-auto max-w-4xl space-y-4"
          role="log"
          aria-live="polite"
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Streaming text */}
          {isStreaming && streamingText && (
            <ChatMessage
              message={{ role: "assistant", content: streamingText }}
              isStreaming={true}
            />
          )}

          {/* Typing indicator */}
          {isStreaming && !streamingText && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Textarea
            className="min-h-[44px] max-h-32 flex-1 resize-none"
            placeholder={t("session.inputPlaceholder")}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isActive || isStreaming}
          />
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-300 text-slate-500"
            disabled
            aria-label="Start recording"
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50"
            onClick={handleSend}
            disabled={!inputText.trim() || isStreaming || !isActive}
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
