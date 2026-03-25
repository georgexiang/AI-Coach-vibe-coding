import { useState, useEffect } from "react";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { RightPanel } from "./components/RightPanel";

interface Message {
  id: string;
  sender: "hcp" | "mr";
  text: string;
  timestamp: Date;
}

interface KeyMessage {
  id: string;
  text: string;
  checked: boolean;
}

interface MessageStatus {
  id: string;
  text: string;
  status: "delivered" | "in-progress" | "pending";
}

export default function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "hcp",
      text: "Good morning, I have about 10 minutes. What brings you here today?",
      timestamp: new Date(),
    },
  ]);

  const [keyMessages, setKeyMessages] = useState<KeyMessage[]>([
    { id: "km1", text: "Efficacy data from Phase III trial", checked: false },
    { id: "km2", text: "Safety profile comparison", checked: false },
    { id: "km3", text: "Dosing convenience", checked: false },
    { id: "km4", text: "Patient quality of life data", checked: false },
  ]);

  const [messageStatuses, setMessageStatuses] = useState<MessageStatus[]>([
    { id: "ms1", text: "Efficacy data", status: "delivered" },
    { id: "ms2", text: "Safety profile", status: "in-progress" },
    { id: "ms3", text: "Dosing convenience", status: "pending" },
    { id: "ms4", text: "Quality of life", status: "pending" },
  ]);

  const [wordCount, setWordCount] = useState(0);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "mr",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    
    // Update word count
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    setWordCount((prev) => prev + words.length);

    // Simulate HCP response after a delay
    setTimeout(() => {
      const responses = [
        "I've seen many claims about PD-1 inhibitors. What makes yours different?",
        "Interesting. Can you provide specific numbers from your trials?",
        "What about the safety profile? I'm particularly concerned about immune-related adverse events.",
        "How does the dosing schedule compare to other options?",
        "That's compelling data. What support programs do you offer for patients?",
      ];
      
      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];

      const hcpMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "hcp",
        text: randomResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, hcpMessage]);
    }, 1500);
  };

  const handleToggleKeyMessage = (id: string) => {
    setKeyMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, checked: !msg.checked } : msg
      )
    );
  };

  const handleEndSession = () => {
    if (confirm("Are you sure you want to end this training session?")) {
      // In a real app, this would save results and navigate away
      alert("Session ended. Results would be saved here.");
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-white">
      <LeftPanel
        isCollapsed={leftCollapsed}
        onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
        keyMessages={keyMessages}
        onToggleKeyMessage={handleToggleKeyMessage}
      />

      <CenterPanel
        sessionTime={formatTime(sessionSeconds)}
        onEndSession={handleEndSession}
        messages={messages}
        onSendMessage={handleSendMessage}
      />

      <RightPanel
        isCollapsed={rightCollapsed}
        onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
        messageStatuses={messageStatuses}
        sessionTime={formatTime(sessionSeconds)}
        wordCount={wordCount}
      />
    </div>
  );
}