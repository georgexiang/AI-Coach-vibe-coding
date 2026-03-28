import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConferenceSSE } from "@/hooks/use-conference-sse";
import type { ConferenceSSECallbacks } from "@/hooks/use-conference-sse";

function createMockReadableStream(
  chunks: string[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function createMockResponse(
  chunks: string[],
  ok = true,
  status = 200,
): Response {
  return {
    ok,
    status,
    body: createMockReadableStream(chunks),
    headers: new Headers(),
  } as unknown as Response;
}

describe("useConferenceSSE", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("access_token", "test-token");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it("should initialize with isStreaming false and empty streamedText", () => {
    const callbacks: ConferenceSSECallbacks = {};
    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedText).toBe("");
  });

  it("should process text events", async () => {
    const onText = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onText };

    const sseData = "event: text\ndata: Hello\n\nevent: text\ndata:  World\n\n";
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test message");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/conference/sessions/sess-1/stream",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({
          action: "present",
          message: "test message",
          target_hcp_id: undefined,
        }),
      }),
    );

    expect(onText).toHaveBeenCalledWith("Hello");
    expect(onText).toHaveBeenCalledWith(" World");
  });

  it("should process speaker_text events", async () => {
    const onSpeakerText = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onSpeakerText };

    const payload = JSON.stringify({
      speaker_id: "hcp-1",
      speaker_name: "Dr. Smith",
      content: "Good question",
    });
    const sseData = `event: speaker_text\ndata: ${payload}\n\n`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onSpeakerText).toHaveBeenCalledWith({
      speaker_id: "hcp-1",
      speaker_name: "Dr. Smith",
      content: "Good question",
    });
  });

  it("should process done events", async () => {
    const onDone = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onDone };

    const sseData = "event: done\ndata: \n\n";
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onDone).toHaveBeenCalled();
  });

  it("should process error events", async () => {
    const onError = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onError };

    const sseData = "event: error\ndata: Something went wrong\n\n";
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onError).toHaveBeenCalledWith("Something went wrong");
  });

  it("should call onError when response is not ok", async () => {
    const onError = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onError };

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([], false, 500),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onError).toHaveBeenCalledWith("Stream failed: 500");
  });

  it("should process queue_update events", async () => {
    const onQueueUpdate = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onQueueUpdate };

    const queue = [{ hcpProfileId: "hcp-1", hcpName: "Dr. X", question: "Why?", relevanceScore: 0.9, status: "waiting" }];
    const sseData = `event: queue_update\ndata: ${JSON.stringify(queue)}\n\n`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onQueueUpdate).toHaveBeenCalledWith(queue);
  });

  it("should process hint events", async () => {
    const onHint = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onHint };

    const sseData = "event: hint\ndata: Try mentioning efficacy data\n\n";
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onHint).toHaveBeenCalledWith("Try mentioning efficacy data");
  });

  it("should pass targetHcpId when provided", async () => {
    const callbacks: ConferenceSSECallbacks = {};

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(["event: done\ndata: \n\n"]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("respond", "", "hcp-1");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          action: "respond",
          message: "",
          target_hcp_id: "hcp-1",
        }),
      }),
    );
  });

  it("should set isStreaming to false after stream completes", async () => {
    const callbacks: ConferenceSSECallbacks = {};

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(["event: done\ndata: \n\n"]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it("should process turn_change events", async () => {
    const onTurnChange = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onTurnChange };

    const turnData = {
      speaker_id: "hcp-2",
      speaker_name: "Dr. Jones",
      action: "asking",
    };
    const sseData = `event: turn_change\ndata: ${JSON.stringify(turnData)}\n\n`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onTurnChange).toHaveBeenCalledWith(turnData);
  });

  it("should process sub_state events", async () => {
    const onSubState = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onSubState };

    const subStateData = {
      sub_state: "qa",
      message: "Entering Q&A phase",
    };
    const sseData = `event: sub_state\ndata: ${JSON.stringify(subStateData)}\n\n`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onSubState).toHaveBeenCalledWith(subStateData);
  });

  it("should process transcription events", async () => {
    const onTranscription = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onTranscription };

    const transcriptData = {
      speaker: "Dr. Smith",
      text: "Can you explain the mechanism?",
      timestamp: "2024-01-01T00:00:00Z",
    };
    const sseData = `event: transcription\ndata: ${JSON.stringify(transcriptData)}\n\n`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onTranscription).toHaveBeenCalledWith(transcriptData);
  });

  it("should process key_messages events", async () => {
    const onKeyMessages = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onKeyMessages };

    const keyMsgs = [
      { message: "Efficacy data shared", delivered: true },
      { message: "Safety profile", delivered: false },
    ];
    const sseData = `event: key_messages\ndata: ${JSON.stringify(keyMsgs)}\n\n`;
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onKeyMessages).toHaveBeenCalledWith(keyMsgs);
  });

  it("should handle heartbeat events silently", async () => {
    const onText = vi.fn();
    const onError = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onText, onError };

    const sseData = "event: heartbeat\ndata: \n\nevent: text\ndata: after-heartbeat\n\n";
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([sseData]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // heartbeat is silently ignored, text after it still processed
    expect(onText).toHaveBeenCalledWith("after-heartbeat");
    expect(onError).not.toHaveBeenCalled();
  });

  it("abort() should cancel the current stream", async () => {
    const callbacks: ConferenceSSECallbacks = {};

    // Never-ending stream
    const mockStream = new ReadableStream<Uint8Array>({
      start() {
        // Never closes
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: mockStream,
      headers: new Headers(),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      // Let fetch start
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    act(() => {
      result.current.abort();
    });

    // The AbortError should be suppressed (not call onError)
  });

  it("should suppress AbortError from onError callback", async () => {
    const onError = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onError };

    // Make fetch throw an AbortError (DOMException constructor's 2nd arg sets name)
    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError"),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // AbortError should not propagate to onError
    expect(onError).not.toHaveBeenCalled();
  });

  it("should call onError with message for non-Error exceptions", async () => {
    const onError = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onError };

    globalThis.fetch = vi.fn().mockRejectedValue("string error");

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onError).toHaveBeenCalledWith("Unknown streaming error");
  });

  it("should abort previous stream when sendMessage is called again", async () => {
    const onText = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onText };

    const firstResponse = createMockResponse(["event: text\ndata: first\n\n"]);
    const secondResponse = createMockResponse(["event: text\ndata: second\n\n"]);

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(firstResponse);
      return Promise.resolve(secondResponse);
    });

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "first message");
      // Quickly send another message which should abort the first
      result.current.sendMessage("present", "second message");
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    // Second message should have been processed
    expect(onText).toHaveBeenCalledWith("second");
  });

  it("should handle missing access_token in localStorage", async () => {
    localStorage.removeItem("access_token");
    const callbacks: ConferenceSSECallbacks = {};

    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(["event: done\ndata: \n\n"]),
    );

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ",
        }),
      }),
    );
  });

  it("should handle response with null body", async () => {
    const onError = vi.fn();
    const callbacks: ConferenceSSECallbacks = { onError };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
      headers: new Headers(),
    } as unknown as Response);

    const { result } = renderHook(() =>
      useConferenceSSE("sess-1", callbacks),
    );

    await act(async () => {
      result.current.sendMessage("present", "test");
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Should throw because !response.body
    expect(onError).toHaveBeenCalledWith("Stream failed: 200");
  });
});
