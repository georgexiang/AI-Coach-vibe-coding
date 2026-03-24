import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
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

interface TestChatMessage {
  role: "user" | "hcp";
  content: string;
}

const MOCK_RESPONSES: Record<string, string[]> = {
  friendly: [
    "Thank you for sharing that information! I'd love to hear more about the clinical data.",
    "That's interesting. Could you tell me about the side effect profile?",
    "I appreciate you taking the time to explain this. My patients might benefit from this.",
  ],
  skeptical: [
    "I'm not convinced yet. What does the evidence really show?",
    "I've heard similar claims before. How is this different from existing treatments?",
    "Can you provide more robust data to support that claim?",
  ],
  busy: [
    "I only have a few minutes. Get to the point please.",
    "That's fine, but what's the bottom line for my patients?",
    "I need to see my next patient soon. Anything else critical?",
  ],
  analytical: [
    "What was the study design? Was it double-blinded and randomized?",
    "I'd like to see the confidence intervals and the NNT data.",
    "How does this compare head-to-head with the current standard of care?",
  ],
  cautious: [
    "I generally prefer to wait for more post-market data before prescribing new treatments.",
    "What about long-term safety? Have there been any post-marketing signals?",
    "I'd need to see more real-world evidence before changing my practice.",
  ],
};

interface TestChatDialogProps {
  profileId: string;
  profileName: string;
  personalityType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestChatDialog({
  profileName,
  personalityType = "friendly",
  open,
  onOpenChange,
}: TestChatDialogProps) {
  const { t } = useTranslation("admin");
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;

    const userMessage: TestChatMessage = { role: "user", content: input.trim() };
    const responses = MOCK_RESPONSES[personalityType] ?? MOCK_RESPONSES["friendly"]!;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)]!;
    const hcpMessage: TestChatMessage = { role: "hcp", content: randomResponse };

    setMessages((prev) => [...prev, userMessage, hcpMessage]);
    setInput("");
  }, [input, personalityType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("hcp.testChat")} - {profileName}
          </DialogTitle>
          <DialogDescription>
            Test conversation with {personalityType} personality
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[300px] rounded-md border p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Send a message to test the HCP personality
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
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
