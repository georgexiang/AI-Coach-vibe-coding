import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSpeechInput } from "@/hooks/use-speech";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@/components/ui";
import {
  ConferenceHeader,
  TopicGuide,
  ConferenceStage,
  TranscriptionPanel,
  AudiencePanel,
  QuestionQueue,
} from "@/components/conference";
import {
  useConferenceSession,
  useEndConferenceSession,
} from "@/hooks/use-conference";
import { useConferenceSSE } from "@/hooks/use-conference-sse";
import type {
  AudienceHcp,
  ConferenceSubState,
  QueuedQuestion,
  TranscriptLine,
  SpeakerTextEvent,
  TurnChangeEvent,
  SubStateEvent,
} from "@/types/conference";

interface ChatMessage {
  id: string;
  sender: "hcp" | "mr";
  text: string;
  timestamp: Date;
  speakerName?: string;
  speakerColor?: string;
}

const SPEAKER_COLORS: string[] = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export default function ConferenceSession() {
  const { t } = useTranslation("conference");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("id") ?? "";
  const hasRequestedStartRef = useRef(false);

  // Fetch session
  const { data: session } = useConferenceSession(sessionId || undefined);
  const endSessionMutation = useEndConferenceSession();

  // Local state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [questionQueue, setQuestionQueue] = useState<QueuedQuestion[]>([]);
  const [audienceHcps, setAudienceHcps] = useState<AudienceHcp[]>([]);
  const [subState, setSubState] = useState<ConferenceSubState>("");
  const [currentSpeaker, setCurrentSpeaker] = useState("");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "audio">("text");
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [keyTopics, setKeyTopics] = useState<
    Array<{ message: string; delivered: boolean }>
  >([]);

  // Session timer
  const [sessionTime, setSessionTime] = useState("00:00");
  useEffect(() => {
    const startTime = session?.createdAt
      ? new Date(session.createdAt).getTime()
      : Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60)
        .toString()
        .padStart(2, "0");
      const secs = (elapsed % 60).toString().padStart(2, "0");
      setSessionTime(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.createdAt]);

  // Initialize audience from session
  useEffect(() => {
    if (session?.audienceConfig) {
      try {
        const parsed = JSON.parse(session.audienceConfig) as AudienceHcp[];
        setAudienceHcps(
          parsed.map((hcp) => ({ ...hcp, status: hcp.status ?? "listening" })),
        );
      } catch {
        // Invalid JSON, skip
      }
    }
  }, [session?.audienceConfig]);

  // Initialize sub-state from session
  useEffect(() => {
    if (session?.subState) {
      setSubState(session.subState);
    }
  }, [session?.subState]);

  // Initialize key topics from session
  useEffect(() => {
    if (session?.keyMessagesStatus) {
      try {
        const parsed = JSON.parse(session.keyMessagesStatus) as Array<{
          message: string;
          delivered: boolean;
        }>;
        setKeyTopics(parsed);
      } catch {
        // Invalid JSON, skip
      }
    }
  }, [session?.keyMessagesStatus]);

  // Speaker color map
  const speakerMap = useMemo(() => {
    const map = new Map<string, number>();
    // MR is always index 0
    map.set("MR", 0);
    audienceHcps.forEach((hcp, index) => {
      map.set(hcp.id, (index % (SPEAKER_COLORS.length - 1)) + 1);
      map.set(hcp.hcpName, (index % (SPEAKER_COLORS.length - 1)) + 1);
    });
    return map;
  }, [audienceHcps]);

  function getSpeakerColor(speakerIdOrName: string): string {
    const index = speakerMap.get(speakerIdOrName) ?? 0;
    return SPEAKER_COLORS[index % SPEAKER_COLORS.length] ?? "var(--primary)";
  }

  // SSE callbacks
  const sseCallbacks = useMemo(
    () => ({
      onText: (_chunk: string) => {
        // streamedText is updated by hook
      },
      onSpeakerText: (data: SpeakerTextEvent) => {
        const msg: ChatMessage = {
          id: `hcp-${Date.now()}-${data.speaker_id}`,
          sender: "hcp",
          text: data.content,
          timestamp: new Date(),
          speakerName: data.speaker_name,
          speakerColor: getSpeakerColor(data.speaker_id),
        };
        setMessages((prev) => [...prev, msg]);
        setCurrentSpeaker(data.speaker_name);
      },
      onQueueUpdate: (queue: QueuedQuestion[]) => {
        setQuestionQueue(queue);
      },
      onTurnChange: (data: TurnChangeEvent) => {
        setCurrentSpeaker(data.speaker_name);
        setAudienceHcps((prev) =>
          prev.map((hcp) =>
            hcp.id === data.speaker_id || hcp.hcpProfileId === data.speaker_id
              ? {
                  ...hcp,
                  status: data.action === "asking" ? "speaking" : "listening",
                }
              : hcp,
          ),
        );
      },
      onSubState: (data: SubStateEvent) => {
        setSubState(data.sub_state);
      },
      onTranscription: (line: {
        speaker: string;
        text: string;
        timestamp: string;
      }) => {
        setTranscriptLines((prev) => [
          ...prev,
          {
            speaker: line.speaker,
            text: line.text,
            timestamp: new Date(line.timestamp),
          },
        ]);
      },
      onKeyMessages: (
        msgs: Array<{ message: string; delivered: boolean }>,
      ) => {
        setKeyTopics(msgs);
      },
      onDone: () => {
        // Session completed
      },
      onError: (error: string) => {
        console.error("Conference SSE error:", error);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speakerMap],
  );

  const { sendMessage, isStreaming, streamedText } = useConferenceSSE(
    sessionId,
    sseCallbacks,
  );

  useEffect(() => {
    if (!sessionId || !session || hasRequestedStartRef.current) return;
    hasRequestedStartRef.current = true;
    sendMessage("start", "");
  }, [sessionId, session, sendMessage]);

  // Handlers
  const handleConferenceInput = useCallback(
    (text: string) => {
      const pendingQuestion = questionQueue[0];
      const userMsg: ChatMessage = {
        id: `mr-${Date.now()}`,
        sender: "mr",
        text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (pendingQuestion) {
        setQuestionQueue((prev) =>
          prev.map((q, index) =>
            index === 0 ? { ...q, status: "active" as const } : q,
          ),
        );
        sendMessage("respond", text, pendingQuestion.hcpProfileId);
        return;
      }

      sendMessage("present", text);
    },
    [questionQueue, sendMessage],
  );

  // Speech input for conference mic
  const handleSpeechTranscribed = useCallback(
    (text: string) => {
      handleConferenceInput(text);
    },
    [handleConferenceInput],
  );
  const {
    startRecording,
    stopRecording,
    recordingState,
    error: speechError,
  } = useSpeechInput(handleSpeechTranscribed);

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const handleConferenceMicClick = useCallback(() => {
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle") {
      void startRecording();
    }
  }, [recordingState, startRecording, stopRecording]);

  const handleRespondToQuestion = useCallback(
    (hcpId: string) => {
      const question = questionQueue.find(
        (q) => q.hcpProfileId === hcpId && q.status === "waiting",
      );
      if (question) {
        setQuestionQueue((prev) =>
          prev.map((q) =>
            q.hcpProfileId === hcpId && q.status === "waiting"
              ? { ...q, status: "active" as const }
              : q,
          ),
        );
        sendMessage("respond", "", hcpId);
      }
    },
    [questionQueue, sendMessage],
  );

  const handleEndSession = useCallback(() => {
    setShowEndDialog(true);
  }, []);

  const confirmEndSession = useCallback(async () => {
    setShowEndDialog(false);
    try {
      await endSessionMutation.mutateAsync(sessionId);
      navigate(`/user/scoring/${sessionId}`);
    } catch {
      // Error handled by mutation
    }
  }, [sessionId, endSessionMutation, navigate]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Conference Header */}
      <ConferenceHeader
        session={session}
        subState={subState}
        onEndSession={handleEndSession}
        sessionTime={sessionTime}
      />

      {/* Main content: TopicGuide + ConferenceStage + TranscriptionPanel */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <TopicGuide
          topics={keyTopics}
          scenarioName={session?.presentationTopic ?? ""}
          isCollapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((prev) => !prev)}
        />

        <ConferenceStage
          sessionId={sessionId}
          onSendMessage={handleConferenceInput}
          isStreaming={isStreaming}
          streamedText={streamedText}
          currentSpeaker={currentSpeaker}
          avatarEnabled={true}
          featureAvatarEnabled={false}
          messages={messages}
          inputMode={inputMode}
          onInputModeChange={setInputMode}
          onMicClick={handleConferenceMicClick}
          recordingState={recordingState}
          disabled={session?.status === "completed"}
        />

        <TranscriptionPanel
          lines={transcriptLines}
          isCollapsed={rightCollapsed}
          onToggle={() => setRightCollapsed((prev) => !prev)}
          speakerMap={speakerMap}
        />
      </div>

      {/* Audience Panel */}
      <AudiencePanel hcps={audienceHcps} />

      {/* Question Queue */}
      <QuestionQueue
        questions={questionQueue}
        onRespondTo={handleRespondToQuestion}
      />

      {/* End session confirmation dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("endPresentation")}</DialogTitle>
            <DialogDescription>
              {t("endConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndDialog(false)}
            >
              {t("continuePresenting")}
            </Button>
            <Button variant="destructive" onClick={confirmEndSession}>
              {t("endPresentation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
