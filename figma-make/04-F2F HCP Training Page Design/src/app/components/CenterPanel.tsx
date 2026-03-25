import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Send,
  Video,
  VideoOff,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "./ui/utils";

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
}

type RecordingState = "idle" | "recording" | "processing";
type InputMode = "text" | "audio";

export function CenterPanel({
  sessionTime,
  onEndSession,
  messages,
  onSendMessage,
}: CenterPanelProps) {
  const [inputText, setInputText] = useState("");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = () => {
    if (recordingState === "idle") {
      setRecordingState("recording");
      // Simulate recording -> processing cycle
      setTimeout(() => {
        setRecordingState("processing");
        setTimeout(() => {
          setRecordingState("idle");
          // Simulate transcription
          onSendMessage(
            "This is a simulated voice message about our PD-1 inhibitor efficacy data."
          );
        }, 1500);
      }, 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Top Bar */}
      <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="h-4 w-4" />
          <span className="font-mono">{sessionTime}</span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onEndSession}
          className="gap-2"
        >
          <AlertCircle className="h-4 w-4" />
          End Session
        </Button>
      </div>

      {/* Avatar Display Area */}
      <div className="h-[240px] bg-slate-900 relative flex items-center justify-center">
        {avatarEnabled ? (
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-32 w-32 border-4 border-white">
              <AvatarImage src="" />
              <AvatarFallback className="bg-blue-600 text-white text-3xl">
                DW
              </AvatarFallback>
            </Avatar>
            <div className="px-3 py-1 bg-slate-800/80 rounded text-white text-xs flex items-center gap-2">
              <Video className="h-3 w-3" />
              Azure AI Avatar
            </div>
          </div>
        ) : (
          <div className="text-slate-500 flex flex-col items-center gap-2">
            <VideoOff className="h-12 w-12" />
            <span className="text-sm">Avatar Disabled</span>
          </div>
        )}

        {/* Avatar Toggle */}
        <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded">
          <Switch
            id="avatar-toggle"
            checked={avatarEnabled}
            onCheckedChange={setAvatarEnabled}
          />
          <Label
            htmlFor="avatar-toggle"
            className="text-white text-xs cursor-pointer"
          >
            Avatar
          </Label>
        </div>
      </div>

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.sender === "mr" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg px-4 py-2.5",
                  message.sender === "hcp"
                    ? "bg-blue-500 text-white"
                    : "bg-slate-200 text-slate-900"
                )}
              >
                <p className="text-sm leading-relaxed">{message.text}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-blue-500 text-white rounded-lg px-4 py-2.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-slate-200 p-4 bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-3">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 min-h-[44px] max-h-32 resize-none"
              disabled={inputMode === "audio"}
            />

            {/* Mic Button */}
            <Button
              size="icon"
              className={cn(
                "h-11 w-11 rounded-full transition-all",
                recordingState === "recording"
                  ? "bg-red-600 hover:bg-red-700 animate-pulse"
                  : recordingState === "processing"
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
              onClick={handleMicClick}
              disabled={recordingState !== "idle"}
            >
              <Mic className="h-5 w-5 text-white" />
            </Button>

            {/* Send Button */}
            <Button
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={handleSend}
              disabled={!inputText.trim() || inputMode === "audio"}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Input Mode:</span>
              <button
                className={cn(
                  "px-3 py-1 rounded text-xs transition-colors",
                  inputMode === "text"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
                onClick={() => setInputMode("text")}
              >
                Text
              </button>
              <button
                className={cn(
                  "px-3 py-1 rounded text-xs transition-colors",
                  inputMode === "audio"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-600"
                )}
                onClick={() => setInputMode("audio")}
              >
                Audio
              </button>
            </div>

            <div className="text-xs text-slate-500">
              {recordingState === "recording" && "🔴 Recording..."}
              {recordingState === "processing" && "⚙️ Processing..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
