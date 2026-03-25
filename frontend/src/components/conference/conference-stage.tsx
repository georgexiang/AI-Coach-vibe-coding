import { useEffect, useRef } from "react";
import {
  ScrollArea,
  Avatar,
  AvatarFallback,
} from "@/components/ui";
import { ChatBubble, ChatInput } from "@/components/shared";

interface ChatMessage {
  id: string;
  sender: "hcp" | "mr";
  text: string;
  timestamp: Date;
  speakerName?: string;
  speakerColor?: string;
}

interface ConferenceStageProps {
  sessionId: string;
  onSendMessage: (text: string) => void;
  isStreaming: boolean;
  streamedText: string;
  currentSpeaker: string;
  avatarEnabled: boolean;
  featureAvatarEnabled: boolean;
  messages?: ChatMessage[];
  inputMode?: "text" | "audio";
  onMicClick?: () => void;
  recordingState?: "idle" | "recording" | "processing";
  disabled?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ConferenceStage({
  onSendMessage,
  isStreaming,
  streamedText,
  currentSpeaker,
  avatarEnabled,
  messages = [],
  inputMode = "text",
  onMicClick,
  recordingState = "idle",
  disabled = false,
}: ConferenceStageProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  const speakerInitials = currentSpeaker ? getInitials(currentSpeaker) : "AI";

  return (
    <div className="flex min-w-[480px] flex-1 flex-col">
      {/* Avatar area */}
      <div className="flex h-[200px] flex-col items-center justify-center bg-slate-900">
        {avatarEnabled && (
          <>
            <Avatar className="size-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {speakerInitials}
              </AvatarFallback>
            </Avatar>
            {currentSpeaker && (
              <p className="mt-2 text-sm text-slate-300">{currentSpeaker}</p>
            )}
          </>
        )}
        {!avatarEnabled && (
          <p className="text-sm text-slate-400">
            {currentSpeaker || "Conference Stage"}
          </p>
        )}
      </div>

      {/* Chat / Response area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              sender={msg.sender}
              text={msg.text}
              timestamp={msg.timestamp}
              speakerName={msg.speakerName}
              speakerColor={msg.speakerColor}
            />
          ))}

          {/* Streaming text indicator */}
          {isStreaming && streamedText && (
            <div className="flex justify-start">
              <div className="max-w-[75%]">
                <div className="rounded-2xl rounded-tl-sm bg-primary px-4 py-2 text-primary-foreground">
                  <p className="whitespace-pre-wrap text-sm">{streamedText}</p>
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isStreaming && !streamedText && (
            <div className="flex justify-start">
              <div className="max-w-[75%]">
                <div className="rounded-2xl rounded-tl-sm bg-primary px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block size-2 animate-bounce rounded-full bg-primary-foreground"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="inline-block size-2 animate-bounce rounded-full bg-primary-foreground"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="inline-block size-2 animate-bounce rounded-full bg-primary-foreground"
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
          onMicClick={onMicClick ?? (() => {})}
          recordingState={recordingState}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
