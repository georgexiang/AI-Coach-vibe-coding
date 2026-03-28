import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceLive } from "./use-voice-live";

const mockConfigure = vi.fn().mockResolvedValue({});
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockSendItem = vi.fn();
const mockGenerateResponse = vi.fn();
const mockResponses = vi.fn().mockReturnValue({
  [Symbol.asyncIterator]: () => ({
    next: () => new Promise(() => {}), // never resolves, simulating long-lived stream
  }),
});

vi.mock("rt-client", () => ({
  RTClient: vi.fn().mockImplementation(() => ({
    configure: mockConfigure,
    close: mockClose,
    responses: mockResponses,
    sendItem: mockSendItem,
    generateResponse: mockGenerateResponse,
  })),
}));

const defaultOptions = {
  language: "zh-CN",
  systemPrompt: "You are a test HCP",
};

const defaultToken = {
  endpoint: "wss://test.api.cognitive.microsoft.com",
  token: "test-token",
  region: "eastus2",
  model: "gpt-4o-realtime",
  avatar_enabled: false,
  avatar_character: "",
  voice_name: "en-US-JennyNeural",
};

describe("useVoiceLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default never-resolving responses
    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise(() => {}),
      }),
    });
  });

  it("initial state: disconnected, idle, not muted", () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));
    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.audioState).toBe("idle");
    expect(result.current.isMuted).toBe(false);
  });

  it("connect() transitions to connecting then connected", async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onConnectionStateChange }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    expect(result.current.connectionState).toBe("connected");
    expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");
    expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
  });

  it("connect() with avatar_enabled adds avatar config", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect({
        ...defaultToken,
        avatar_enabled: true,
        avatar_character: "lisa",
      });
    });

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: expect.objectContaining({
          character: "lisa",
        }),
      }),
    );
  });

  it("connect() failure sets error state and calls onError", async () => {
    mockConfigure.mockRejectedValueOnce(new Error("Connection refused"));
    const onError = vi.fn();
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError, onConnectionStateChange }),
    );

    let caught: Error | undefined;
    await act(async () => {
      try {
        await result.current.connect({
          ...defaultToken,
          endpoint: "wss://bad-endpoint",
        });
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught?.message).toBe("Connection refused");
    expect(result.current.connectionState).toBe("error");
    expect(onError).toHaveBeenCalled();
    expect(onConnectionStateChange).toHaveBeenCalledWith("error");
  });

  it("connect() failure with non-Error wraps in Error", async () => {
    mockConfigure.mockRejectedValueOnce("string error");
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError }),
    );

    await act(async () => {
      try {
        await result.current.connect(defaultToken);
      } catch {
        // expected
      }
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0]![0] as Error).message).toBe("string error");
  });

  it("disconnect() resets state", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.isMuted).toBe(false);
    expect(result.current.audioState).toBe("idle");
  });

  it("disconnect() calls onConnectionStateChange with disconnected", async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onConnectionStateChange }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });
    onConnectionStateChange.mockClear();

    await act(async () => {
      await result.current.disconnect();
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith("disconnected");
  });

  it("disconnect() when client.close throws ignores error", async () => {
    mockClose.mockRejectedValueOnce(new Error("close failed"));
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    await act(async () => {
      await result.current.disconnect(); // should not throw
    });

    expect(result.current.connectionState).toBe("disconnected");
  });

  it("disconnect() when no client is a no-op", async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onConnectionStateChange }),
    );

    await act(async () => {
      await result.current.disconnect();
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith("disconnected");
    expect(result.current.connectionState).toBe("disconnected");
  });

  it("toggleMute() toggles isMuted state", () => {
    const onAudioStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onAudioStateChange }),
    );

    act(() => result.current.toggleMute());
    expect(result.current.isMuted).toBe(true);
    expect(onAudioStateChange).toHaveBeenCalledWith("muted");

    act(() => result.current.toggleMute());
    expect(result.current.isMuted).toBe(false);
    expect(onAudioStateChange).toHaveBeenCalledWith("idle");
  });

  it("sendTextMessage() does nothing when not connected", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));
    await act(async () => {
      await result.current.sendTextMessage("hello");
    });
    expect(mockSendItem).not.toHaveBeenCalled();
    expect(mockGenerateResponse).not.toHaveBeenCalled();
  });

  it("sendTextMessage() sends message and generates response when connected", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    await act(async () => {
      await result.current.sendTextMessage("hello");
    });

    expect(mockSendItem).toHaveBeenCalledWith({
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "hello" }],
    });
    expect(mockGenerateResponse).toHaveBeenCalled();
  });

  it("processResponse handles transcriptChunks and calls onTranscript", async () => {
    const onTranscript = vi.fn();
    const onAudioStateChange = vi.fn();

    // Create a response that yields transcript chunks then completes
    let resolveResponses: (() => void) | undefined;
    const responsePromise = new Promise<void>((r) => {
      resolveResponses = r;
    });
    const mockResponse = {
      transcriptChunks: () => ({
        [Symbol.asyncIterator]: () => {
          const chunks = ["Hello", " World"];
          let idx = 0;
          return {
            async next() {
              if (idx < chunks.length) {
                return { value: chunks[idx++], done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      }),
    };

    // Set up responses to yield exactly one response then complete
    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => {
        let yielded = false;
        return {
          async next() {
            if (!yielded) {
              yielded = true;
              return { value: mockResponse, done: false };
            }
            // Signal the test that we are done
            resolveResponses?.();
            return { value: undefined, done: true };
          },
        };
      },
    });

    const { result } = renderHook(() =>
      useVoiceLive({
        ...defaultOptions,
        onTranscript,
        onAudioStateChange,
      }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    // Wait for response processing to finish
    await act(async () => {
      await responsePromise;
    });

    // Verify transcript callbacks were called
    expect(onTranscript).toHaveBeenCalled();

    // Find the final transcript call
    const finalCall = onTranscript.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { isFinal: boolean }).isFinal === true,
    );
    expect(finalCall).toBeTruthy();
    expect((finalCall![0] as { content: string }).content).toBe(
      "Hello World",
    );

    // Verify audio state transitions
    expect(onAudioStateChange).toHaveBeenCalledWith("speaking");
    expect(onAudioStateChange).toHaveBeenCalledWith("idle");
  });

  it("processResponse with no transcriptChunks skips transcript callbacks", async () => {
    const onTranscript = vi.fn();
    const onAudioStateChange = vi.fn();

    let resolveResponses: (() => void) | undefined;
    const responsePromise = new Promise<void>((r) => {
      resolveResponses = r;
    });

    // Response with no transcriptChunks
    const mockResponse = {};

    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => {
        let yielded = false;
        return {
          async next() {
            if (!yielded) {
              yielded = true;
              return { value: mockResponse, done: false };
            }
            resolveResponses?.();
            return { value: undefined, done: true };
          },
        };
      },
    });

    const { result } = renderHook(() =>
      useVoiceLive({
        ...defaultOptions,
        onTranscript,
        onAudioStateChange,
      }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    await act(async () => {
      await responsePromise;
    });

    // onTranscript should NOT be called with a final segment since no transcript
    const finalCalls = onTranscript.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as { isFinal: boolean }).isFinal === true,
    );
    expect(finalCalls.length).toBe(0);

    // Audio state should still transition
    expect(onAudioStateChange).toHaveBeenCalledWith("speaking");
    expect(onAudioStateChange).toHaveBeenCalledWith("idle");
  });

  it("startResponseListener calls onError when response loop throws (while connected)", async () => {
    const onError = vi.fn();

    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<{ value: undefined; done: boolean }> {
          throw new Error("Stream broken");
        },
      }),
    });

    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    // Allow microtask for the background response listener to throw
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0]![0] as Error).message).toBe("Stream broken");
  });

  it("startResponseListener wraps non-Error in Error for onError", async () => {
    const onError = vi.fn();

    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        async next(): Promise<{ value: undefined; done: boolean }> {
          throw "string failure";
        },
      }),
    });

    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect((onError.mock.calls[0]![0] as Error).message).toBe("string failure");
  });

  it("startResponseListener suppresses error when already disconnected", async () => {
    const onError = vi.fn();

    let rejectNext: ((e: Error) => void) | undefined;
    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next() {
          return new Promise((_resolve, reject) => {
            rejectNext = reject;
          });
        },
      }),
    });

    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    // Disconnect first, which sets connectionStateRef to "disconnected"
    await act(async () => {
      await result.current.disconnect();
    });

    // Now trigger the response listener error
    await act(async () => {
      rejectNext?.(new Error("after disconnect"));
      await new Promise((r) => setTimeout(r, 50));
    });

    // onError should NOT be called because we are disconnected
    expect(onError).not.toHaveBeenCalled();
  });

  it("connect() uses openai/realtime WebSocket path for model mode (no agent_id)", async () => {
    const { RTClient } = await import("rt-client");
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    // Verify URL used for RTClient construction includes openai/realtime
    const constructorCall = (RTClient as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = constructorCall?.[0] as URL;
    expect(url.pathname).toBe("/openai/realtime");
    expect(url.searchParams.get("deployment")).toBe("gpt-4o-realtime");
  });

  it("connect() uses voice-agent/realtime WebSocket path for agent mode", async () => {
    const { RTClient } = await import("rt-client");
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    const agentToken = {
      ...defaultToken,
      agent_id: "agent-123",
      project_name: "my-project",
    };

    await act(async () => {
      await result.current.connect(agentToken);
    });

    // Verify URL used for RTClient construction includes voice-agent/realtime
    const lastCall = (RTClient as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const url = lastCall?.[0] as URL;
    expect(url.pathname).toBe("/voice-agent/realtime");
    expect(url.searchParams.get("api-version")).toBe("2025-04-01-preview");
  });

  it("connect() includes agent_id and project_name in session config for agent mode", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    const agentToken = {
      ...defaultToken,
      agent_id: "agent-456",
      project_name: "demo-project",
    };

    await act(async () => {
      await result.current.connect(agentToken);
    });

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: "agent-456",
        project_name: "demo-project",
      }),
    );
  });

  it("connect() does not include agent_id in session config for model mode", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    const configArg = mockConfigure.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(configArg["agent_id"]).toBeUndefined();
    expect(configArg["project_name"]).toBeUndefined();
  });

  it("processResponse emits partial (non-final) transcript segments", async () => {
    const onTranscript = vi.fn();

    let resolveResponses: (() => void) | undefined;
    const responsePromise = new Promise<void>((r) => {
      resolveResponses = r;
    });

    const mockResponse = {
      transcriptChunks: () => ({
        [Symbol.asyncIterator]: () => {
          const chunks = ["A", "B", "C"];
          let idx = 0;
          return {
            async next() {
              if (idx < chunks.length) {
                return { value: chunks[idx++], done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      }),
    };

    mockResponses.mockReturnValue({
      [Symbol.asyncIterator]: () => {
        let yielded = false;
        return {
          async next() {
            if (!yielded) {
              yielded = true;
              return { value: mockResponse, done: false };
            }
            resolveResponses?.();
            return { value: undefined, done: true };
          },
        };
      },
    });

    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onTranscript }),
    );

    await act(async () => {
      await result.current.connect(defaultToken);
    });

    await act(async () => {
      await responsePromise;
    });

    // Should have 3 partial calls + 1 final call = at least 4
    expect(onTranscript.mock.calls.length).toBeGreaterThanOrEqual(4);

    // Check partial segments have isFinal: false
    const partialCalls = onTranscript.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as { isFinal: boolean }).isFinal === false,
    );
    expect(partialCalls.length).toBe(3);

    // Check content accumulates
    expect((partialCalls[0]![0] as { content: string }).content).toBe("A");
    expect((partialCalls[1]![0] as { content: string }).content).toBe("AB");
    expect((partialCalls[2]![0] as { content: string }).content).toBe("ABC");

    // Check final segment
    const finalCalls = onTranscript.mock.calls.filter(
      (call: unknown[]) =>
        (call[0] as { isFinal: boolean }).isFinal === true,
    );
    expect(finalCalls.length).toBe(1);
    expect((finalCalls[0]![0] as { content: string }).content).toBe("ABC");
  });
});
