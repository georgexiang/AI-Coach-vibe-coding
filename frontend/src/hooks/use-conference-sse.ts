import { useCallback, useRef, useState } from "react";
import type {
  QueuedQuestion,
  SpeakerTextEvent,
  SubStateEvent,
  TurnChangeEvent,
} from "@/types/conference";

export interface ConferenceSSECallbacks {
  onText?: (chunk: string) => void;
  onSpeakerText?: (data: SpeakerTextEvent) => void;
  onQueueUpdate?: (queue: QueuedQuestion[]) => void;
  onTurnChange?: (data: TurnChangeEvent) => void;
  onSubState?: (data: SubStateEvent) => void;
  onTranscription?: (line: {
    speaker: string;
    text: string;
    timestamp: string;
  }) => void;
  onHint?: (hint: string) => void;
  onKeyMessages?: (
    messages: Array<{ message: string; delivered: boolean }>,
  ) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

interface UseConferenceSSEReturn {
  sendMessage: (
    action: string,
    message: string,
    targetHcpId?: string,
  ) => void;
  isStreaming: boolean;
  streamedText: string;
  abort: () => void;
}

export function useConferenceSSE(
  sessionId: string,
  callbacks: ConferenceSSECallbacks,
): UseConferenceSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(
    (action: string, message: string, targetHcpId?: string) => {
      // Abort any existing stream
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamedText("");

      const token = localStorage.getItem("access_token");

      void (async () => {
        try {
          const response = await fetch(
            `/api/v1/conference/sessions/${sessionId}/stream`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token ?? ""}`,
              },
              body: JSON.stringify({
                action,
                message,
                target_hcp_id: targetHcpId,
              }),
              signal: controller.signal,
            },
          );

          if (!response.ok || !response.body) {
            throw new Error(`Stream failed: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            let currentEvent = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const data = line.slice(6);
                processEvent(currentEvent, data, callbacksRef, setStreamedText);
              }
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const msg =
            err instanceof Error ? err.message : "Unknown streaming error";
          callbacksRef.current.onError?.(msg);
        } finally {
          setIsStreaming(false);
        }
      })();
    },
    [sessionId],
  );

  return { sendMessage, isStreaming, streamedText, abort };
}

function processEvent(
  eventType: string,
  data: string,
  callbacksRef: React.RefObject<ConferenceSSECallbacks>,
  setStreamedText: React.Dispatch<React.SetStateAction<string>>,
): void {
  const cb = callbacksRef.current;
  if (!cb) return;
  switch (eventType) {
    case "text":
      setStreamedText((prev) => prev + data);
      cb.onText?.(data);
      break;
    case "speaker_text":
      cb.onSpeakerText?.(JSON.parse(data) as SpeakerTextEvent);
      break;
    case "queue_update":
      cb.onQueueUpdate?.(JSON.parse(data) as QueuedQuestion[]);
      break;
    case "turn_change":
      cb.onTurnChange?.(JSON.parse(data) as TurnChangeEvent);
      break;
    case "sub_state":
      cb.onSubState?.(JSON.parse(data) as SubStateEvent);
      break;
    case "transcription":
      cb.onTranscription?.(
        JSON.parse(data) as { speaker: string; text: string; timestamp: string },
      );
      break;
    case "hint":
      cb.onHint?.(data);
      break;
    case "key_messages":
      cb.onKeyMessages?.(
        JSON.parse(data) as Array<{ message: string; delivered: boolean }>,
      );
      break;
    case "done":
      cb.onDone?.();
      break;
    case "error":
      cb.onError?.(data);
      break;
    case "heartbeat":
      // Heartbeat events keep the connection alive; no action needed
      break;
  }
}
