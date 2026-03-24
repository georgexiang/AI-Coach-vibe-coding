import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LeftPanel, CenterPanel, RightPanel } from "@/components/coach";

// TODO: Replace with TanStack Query hook in Phase 2
interface Message {
  id: string;
  sender: "hcp" | "mr";
  text: string;
  timestamp: Date;
}

interface KeyMessage {
  id: string;
  label: string;
  checked: boolean;
}

const mockKeyMessages: KeyMessage[] = [
  { id: "1", label: "Efficacy data from Phase III trial", checked: false },
  { id: "2", label: "Safety profile comparison", checked: false },
  { id: "3", label: "Dosing convenience", checked: false },
  { id: "4", label: "Patient quality of life data", checked: false },
];

const mockScoringCriteria = [
  { label: "Key Message", weight: 30 },
  { label: "Objection Handling", weight: 25 },
  { label: "Communication", weight: 20 },
  { label: "Product Knowledge", weight: 15 },
  { label: "Scientific", weight: 10 },
];

const mockHints = [
  {
    id: "1",
    text: "Consider mentioning the Phase III overall survival data",
  },
  { id: "2", text: "Dr. Wang values specific numbers — use statistics" },
];

const mockMessageStatuses = [
  { id: "1", label: "Efficacy data", status: "delivered" as const },
  { id: "2", label: "Safety profile", status: "in-progress" as const },
  { id: "3", label: "Dosing convenience", status: "pending" as const },
  { id: "4", label: "Quality of life", status: "pending" as const },
];

const mockHcpResponses = [
  "Interesting. Can you tell me more about the efficacy data?",
  "I see. How does the safety profile compare to the current standard?",
  "What about the dosing schedule? How convenient is it for patients?",
  "Those are good points. Do you have any real-world evidence to support this?",
  "Thank you for the information. I will consider it for my patients.",
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function TrainingSession() {
  const { t } = useTranslation("training");
  const navigate = useNavigate();

  // Panel collapse state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "hcp",
      text: "Good morning, I have about 10 minutes. What brings you here today?",
      timestamp: new Date(),
    },
  ]);
  const [keyMessages, setKeyMessages] = useState(mockKeyMessages);
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [inputMode, setInputMode] = useState<"text" | "audio">("text");
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "processing"
  >("idle");
  const [isTyping, setIsTyping] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sessionTime = formatTime(elapsedSeconds);

  // HCP info
  const hcpName = "Dr. Wang Wei";
  const hcpInitials = "DW";

  // Handlers
  const handleSendMessage = useCallback(
    (text: string) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: "mr",
        text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setWordCount((prev) => prev + text.split(/\s+/).length);

      // Simulate HCP typing and response
      setIsTyping(true);
      const responseIndex =
        (messages.length - 1) % mockHcpResponses.length;
      const responseText =
        mockHcpResponses[responseIndex] ?? mockHcpResponses[0];

      setTimeout(() => {
        const hcpMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: "hcp",
          text: responseText ?? "",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, hcpMessage]);
        setIsTyping(false);
      }, 1500);
    },
    [messages.length],
  );

  const handleEndSession = useCallback(() => {
    if (confirm(t("endSessionConfirm"))) {
      navigate("/user/dashboard");
    }
  }, [t, navigate]);

  const handleToggleKeyMessage = useCallback((id: string) => {
    setKeyMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, checked: !msg.checked } : msg,
      ),
    );
  }, []);

  const handleMicClick = useCallback(() => {
    if (inputMode === "text") {
      setInputMode("audio");
      setRecordingState("idle");
    } else if (recordingState === "idle") {
      setRecordingState("recording");
    } else if (recordingState === "recording") {
      setRecordingState("processing");
      // Simulate processing
      setTimeout(() => {
        setRecordingState("idle");
        setInputMode("text");
      }, 1000);
    }
  }, [inputMode, recordingState]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <LeftPanel
        isCollapsed={leftCollapsed}
        onToggleCollapse={() => setLeftCollapsed((prev) => !prev)}
        scenarioProduct="PD-1 Inhibitor"
        scenarioContext="Initial visit with Dr. Wang to introduce new Phase III trial data for our PD-1 Inhibitor. Focus on efficacy and safety advantages over current standard of care."
        hcpName={hcpName}
        hcpSpecialty="Oncologist"
        hcpPersonality="Skeptical, Detail-oriented"
        hcpBackground="Prefers evidence-based data, concerned about side effects"
        keyMessages={keyMessages}
        onToggleKeyMessage={handleToggleKeyMessage}
        scoringCriteria={mockScoringCriteria}
      />

      <CenterPanel
        sessionTime={sessionTime}
        onEndSession={handleEndSession}
        messages={messages}
        onSendMessage={handleSendMessage}
        avatarEnabled={avatarEnabled}
        onToggleAvatar={setAvatarEnabled}
        hcpInitials={hcpInitials}
        isTyping={isTyping}
        inputMode={inputMode}
        onMicClick={handleMicClick}
        recordingState={recordingState}
      />

      <RightPanel
        isCollapsed={rightCollapsed}
        onToggleCollapse={() => setRightCollapsed((prev) => !prev)}
        hints={mockHints}
        messageStatuses={mockMessageStatuses}
        sessionTime={sessionTime}
        wordCount={wordCount}
      />
    </div>
  );
}
