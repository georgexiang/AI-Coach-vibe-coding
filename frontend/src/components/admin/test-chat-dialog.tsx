import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { testChatWithAgent } from "@/api/hcp-profiles";

interface TestChatMessage {
  role: "user" | "hcp";
  content: string;
}

interface TestChatDialogProps {
  profileId: string;
  profileName: string;
  personalityType?: string;
  agentId?: string;
  agentVersion?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestChatDialog({
  profileId,
  profileName,
  personalityType = "friendly",
  agentId,
  open,
  onOpenChange,
}: TestChatDialogProps) {
  const { t } = useTranslation("admin");
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput("");
      setError(null);
      setResponseId(null);
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: TestChatMessage = {
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const result = await testChatWithAgent(profileId, {
        message: userMessage.content,
        previous_response_id: responseId ?? undefined,
      });

      setResponseId(result.response_id);
      setMessages((prev) => [
        ...prev,
        { role: "hcp", content: result.response_text },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to get agent response";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "hcp", content: `[Error] ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, profileId, responseId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasAgent = !!agentId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("hcp.testChat")} - {profileName}
          </DialogTitle>
          <DialogDescription>
            {hasAgent
              ? `Real-time conversation with AI Foundry Agent (${personalityType})`
              : "No agent synced — sync the agent first to enable chat"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[350px] rounded-md border p-4" ref={scrollRef}>
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {hasAgent
                  ? "Send a message to chat with the AI Foundry Agent"
                  : "Agent sync required before chatting"}
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-slate-200 text-slate-900"
                      : msg.content.startsWith("[Error]")
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-500 text-white"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-700">
                  <Loader2 className="size-3.5 animate-spin" />
                  Agent is thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {error && (
          <p className="text-xs text-red-600 px-1">{error}</p>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasAgent
                ? "Type a message..."
                : "Agent not synced"
            }
            className="flex-1"
            disabled={!hasAgent || isLoading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || !hasAgent || isLoading}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
