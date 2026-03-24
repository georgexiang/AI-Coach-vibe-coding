import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import {
  ScrollArea,
  Button,
  Switch,
  Avatar,
  AvatarFallback,
} from "@/components/ui";
import { ChatBubble, ChatInput } from "@/components/shared";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: "hcp" | "mr";
  text: string;
  timestamp: Date;
}

interface CenterPanelProps {
  sessionTime: string;
  onEndSession: () => void;
  messages: Message[];
  onSendMessage: (text: string) => void;
  avatarEnabled: boolean;
  onToggleAvatar: (enabled: boolean) => void;
  hcpInitials: string;
  isTyping: boolean;
  inputMode: "text" | "audio";
  onMicClick: () => void;
  recordingState: "idle" | "recording" | "processing";
}

export function CenterPanel({
  sessionTime,
  onEndSession,
  messages,
  onSendMessage,
  avatarEnabled,
  onToggleAvatar,
  hcpInitials,
  isTyping,
  inputMode,
  onMicClick,
  recordingState,
}: CenterPanelProps) {
  const { t } = useTranslation("training");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-4" />
          <span className="font-mono text-sm">{sessionTime}</span>
        </div>
        <Button variant="destructive" size="sm" onClick={onEndSession}>
          {t("endSession")}
        </Button>
      </div>

      {/* Avatar area */}
      <div className="relative flex h-[240px] flex-col items-center justify-center bg-slate-900">
        {avatarEnabled ? (
          <>
            <Avatar className="size-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {hcpInitials}
              </AvatarFallback>
            </Avatar>
            <div className="mt-3 flex items-center gap-2">
              <Switch
                checked={avatarEnabled}
                onCheckedChange={onToggleAvatar}
              />
              <span className="text-xs text-slate-300">
                {t("azureAiAvatar")}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-slate-400">{t("avatarDisabled")}</p>
            <div className="flex items-center gap-2">
              <Switch
                checked={avatarEnabled}
                onCheckedChange={onToggleAvatar}
              />
              <span className="text-xs text-slate-300">
                {t("azureAiAvatar")}
              </span>
            </div>
          </div>
        )}
        {/* Top-right avatar toggle label */}
        <div className="absolute right-4 top-3 flex items-center gap-2">
          <span className="text-xs text-slate-300">{t("avatar")}</span>
          <Switch checked={avatarEnabled} onCheckedChange={onToggleAvatar} />
        </div>
      </div>

      {/* Chat area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              sender={msg.sender}
              text={msg.text}
              timestamp={msg.timestamp}
            />
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[75%]">
                <div className="rounded-2xl rounded-tl-sm bg-primary px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block size-2 animate-bounce rounded-full bg-primary-foreground",
                      )}
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className={cn(
                        "inline-block size-2 animate-bounce rounded-full bg-primary-foreground",
                      )}
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className={cn(
                        "inline-block size-2 animate-bounce rounded-full bg-primary-foreground",
                      )}
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4">
        <ChatInput
          onSend={onSendMessage}
          inputMode={inputMode}
          onMicClick={onMicClick}
          recordingState={recordingState}
        />
      </div>
    </div>
  );
}
