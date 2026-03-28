import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Send, Mic, Volume2, VolumeX } from "lucide-react";
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
import { useSpeechInput, useTextToSpeech } from "@/hooks/use-speech";
import { useConfig } from "@/contexts/config-context";
import { cn } from "@/lib/utils";
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
  ttsEnabled?: boolean;
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

  const config = useConfig();
  const voiceEnabled = config.voice_enabled;

  const isActive =
    sessionStatus === "in_progress" || sessionStatus === "created";

  // Speech input (STT): record mic -> transcribe -> send as message
  const handleTranscribed = useCallback(
    (text: string) => {
      onSendMessage(text);
    },
    [onSendMessage],
  );
  const { startRecording, stopRecording, recordingState } = useSpeechInput(
    handleTranscribed,
  );

  const handleMicClick = useCallback(() => {
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle") {
      void startRecording();
    }
    // Do nothing if "processing"
  }, [recordingState, startRecording, stopRecording]);

  // TTS playback for AI responses
  const { speak, stop: stopSpeech, isSpeaking } = useTextToSpeech();
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);

  // Auto-play TTS when SSE streaming completes and ttsAutoPlay is on
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (
      prevStreamingRef.current &&
      !isStreaming &&
      ttsAutoPlay &&
      voiceEnabled
    ) {
      // Find the last assistant message
      const lastMsg = [...messages].reverse().find((m) => m.role === "assistant");
      if (lastMsg) {
        void speak(lastMsg.content);
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, messages, ttsAutoPlay, voiceEnabled, speak]);

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
    [handleSend],
  );

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Top bar */}
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <SessionTimer startedAt={startedAt ?? null} />
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndSession}
          disabled={!isActive}
          className="transition-colors duration-150"
        >
          <AlertCircle className="mr-1 h-4 w-4" />
          {t("session.endSession")}
        </Button>
      </div>

      {/* Avatar display area */}
      <div className="relative flex h-[240px] items-center justify-center bg-foreground/5 dark:bg-foreground/10">
        {avatarEnabled && (
          <Avatar className="h-32 w-32 border-4 border-background">
            <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
              {hcpInitials}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="absolute right-3 top-3 flex items-center gap-2 rounded bg-background/80 px-3 py-1.5">
          <span className="text-sm text-foreground">Avatar</span>
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
      <div className="border-t border-border bg-muted/50 p-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Textarea
            className="min-h-[44px] max-h-32 flex-1 resize-none"
            placeholder={t("session.inputPlaceholder")}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={
              !isActive || isStreaming || recordingState === "recording"
            }
          />
          {voiceEnabled && (
            <button
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150",
                recordingState === "recording"
                  ? "animate-pulse bg-destructive text-destructive-foreground"
                  : recordingState === "processing"
                    ? "bg-yellow-400 text-white dark:bg-yellow-500"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              onClick={handleMicClick}
              disabled={
                !isActive || isStreaming || recordingState === "processing"
              }
              aria-label={
                recordingState === "recording"
                  ? t("session.stopRecording")
                  : t("session.startRecording")
              }
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
          {voiceEnabled && (
            <button
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150",
                ttsAutoPlay
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              onClick={() => {
                if (isSpeaking) stopSpeech();
                setTtsAutoPlay((prev) => !prev);
              }}
              aria-label={
                ttsAutoPlay
                  ? t("session.ttsOff")
                  : t("session.ttsOn")
              }
            >
              {ttsAutoPlay ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 disabled:opacity-50"
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
