import { useCallback, useRef, useState } from "react";

interface SSECallbacks {
  onText?: (text: string) => void;
  onHint?: (hint: string) => void;
  onKeyMessages?: (messages: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (sessionId: string, message: string) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsStreaming(true);
      setStreamedText("");
      setError(null);

      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`/api/v1/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: message }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE request failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

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
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              switch (currentEvent) {
                case "text":
                  setStreamedText((prev) => prev + data);
                  callbacks.onText?.(data);
                  break;
                case "hint":
                  callbacks.onHint?.(data);
                  break;
                case "key_messages":
                  callbacks.onKeyMessages?.(data);
                  break;
                case "done":
                  callbacks.onDone?.();
                  break;
                case "error":
                  setError(data);
                  callbacks.onError?.(data);
                  break;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const msg = err instanceof Error ? err.message : "SSE connection failed";
        setError(msg);
        callbacks.onError?.(msg);
      } finally {
        setIsStreaming(false);
      }
    },
    [callbacks]
  );

  return { sendMessage, isStreaming, streamedText, error, abort };
}
