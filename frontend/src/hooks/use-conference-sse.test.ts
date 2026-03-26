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
      // Wait for stream to finish
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
});
