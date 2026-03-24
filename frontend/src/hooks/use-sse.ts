import { useCallback, useRef, useState } from "react";
import type { CoachingHint, KeyMessageStatus } from "@/types/session";

interface SSECallbacks {
  onText: (chunk: string) => void;
  onHint: (hint: CoachingHint) => void;
  onKeyMessages: (status: KeyMessageStatus[]) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

interface UseSSEStreamReturn {
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  abort: () => void;
}

export function useSSEStream(callbacks: SSECallbacks): UseSSEStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (sessionId: string, message: string) => {
      setIsStreaming(true);
      setStreamedText("");
      setError(null);

      abortRef.current = new AbortController();
      const token = localStorage.getItem("access_token");

      try {
        const response = await fetch(
          `/api/v1/sessions/${sessionId}/message`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message }),
            signal: abortRef.current.signal,
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
              switch (currentEvent) {
                case "text":
                  setStreamedText((prev) => prev + data);
                  callbacks.onText(data);
                  break;
                case "hint":
                  callbacks.onHint(JSON.parse(data) as CoachingHint);
                  break;
                case "key_messages":
                  callbacks.onKeyMessages(
                    JSON.parse(data) as KeyMessageStatus[],
                  );
                  break;
                case "done":
                  callbacks.onDone();
                  break;
                case "error":
                  setError(data);
                  callbacks.onError(data);
                  break;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "Unknown streaming error";
        setError(msg);
        callbacks.onError(msg);
      } finally {
        setIsStreaming(false);
      }
    },
    [callbacks],
  );

  return { sendMessage, isStreaming, streamedText, error, abort };
}
