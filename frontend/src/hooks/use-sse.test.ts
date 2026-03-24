import { renderHook, act } from "@testing-library/react";
import { useSSEStream } from "./use-sse";

// Helper to create a ReadableStream from SSE-formatted string chunks
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
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

describe("useSSEStream", () => {
  const mockCallbacks = {
    onText: vi.fn(),
    onHint: vi.fn(),
    onKeyMessages: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("test-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with isStreaming false and empty streamedText", () => {
    const { result } = renderHook(() => useSSEStream(mockCallbacks));
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamedText).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("parses text events and calls onText callback", async () => {
    const stream = createSSEStream([
      "event: text\ndata: Hello\n\n",
      "event: text\ndata:  World\n\n",
      "event: done\ndata: \n\n",
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const { result } = renderHook(() => useSSEStream(mockCallbacks));

    await act(async () => {
      await result.current.sendMessage("sess-1", "Hi");
    });

    expect(mockCallbacks.onText).toHaveBeenCalledWith("Hello");
    expect(mockCallbacks.onText).toHaveBeenCalledWith(" World");
    expect(mockCallbacks.onDone).toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
  });

  it("parses hint events and calls onHint callback", async () => {
    const hintData = JSON.stringify({ content: "Try asking about safety" });
    const stream = createSSEStream([
      `event: hint\ndata: ${hintData}\n\n`,
      "event: done\ndata: \n\n",
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const { result } = renderHook(() => useSSEStream(mockCallbacks));

    await act(async () => {
      await result.current.sendMessage("sess-1", "Test");
    });

    expect(mockCallbacks.onHint).toHaveBeenCalledWith({
      content: "Try asking about safety",
    });
  });

  it("handles fetch failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    } as unknown as Response);

    const { result } = renderHook(() => useSSEStream(mockCallbacks));

    await act(async () => {
      await result.current.sendMessage("sess-1", "Test");
    });

    expect(mockCallbacks.onError).toHaveBeenCalledWith(
      "Stream failed: 500",
    );
    expect(result.current.error).toBe("Stream failed: 500");
    expect(result.current.isStreaming).toBe(false);
  });

  it("sends correct request with auth header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: createSSEStream(["event: done\ndata: \n\n"]),
    } as Response);

    const { result } = renderHook(() => useSSEStream(mockCallbacks));

    await act(async () => {
      await result.current.sendMessage("sess-1", "Hello");
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/sessions/sess-1/message",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        }),
        body: JSON.stringify({ message: "Hello" }),
      }),
    );
  });

  it("abort sets the abort controller to null", () => {
    const { result } = renderHook(() => useSSEStream(mockCallbacks));

    // Calling abort without an active stream should not throw
    act(() => {
      result.current.abort();
    });

    // Verify the hook still works (isStreaming is false)
    expect(result.current.isStreaming).toBe(false);
  });

  it("parses key_messages events correctly", async () => {
    const keyMsgData = JSON.stringify([
      { message: "Key 1", delivered: true, detected_at: "2024-01-01" },
    ]);
    const stream = createSSEStream([
      `event: key_messages\ndata: ${keyMsgData}\n\n`,
      "event: done\ndata: \n\n",
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const { result } = renderHook(() => useSSEStream(mockCallbacks));

    await act(async () => {
      await result.current.sendMessage("sess-1", "Test");
    });

    expect(mockCallbacks.onKeyMessages).toHaveBeenCalledWith([
      { message: "Key 1", delivered: true, detected_at: "2024-01-01" },
    ]);
  });
});
