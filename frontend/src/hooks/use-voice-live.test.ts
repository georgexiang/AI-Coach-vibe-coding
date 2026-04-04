import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceLive } from "./use-voice-live";

// ---- Mock WebSocket ----

type WSHandler = ((event: { data: string }) => void) | null;

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: WSHandler = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;

  sentMessages: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.(new Error("ws error"));
  }
}

// Replace global WebSocket
const OriginalWebSocket = globalThis.WebSocket;

// Mock localStorage for JWT token
const mockLocalStorage: Record<string, string> = {};
const OriginalLocalStorage = globalThis.localStorage;

const defaultOptions = {
  language: "zh-CN",
  systemPrompt: "You are a test HCP",
};

describe("useVoiceLive (backend WebSocket proxy)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.WebSocket = MockWebSocket as any;

    // Setup localStorage mock with a test JWT token
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => mockLocalStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          mockLocalStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockLocalStorage[key];
        },
        clear: () => {
          Object.keys(mockLocalStorage).forEach(
            (k) => delete mockLocalStorage[k],
          );
        },
      },
      writable: true,
      configurable: true,
    });
    mockLocalStorage["access_token"] = "test-jwt-token-123";
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    Object.defineProperty(globalThis, "localStorage", {
      value: OriginalLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  });

  function getLastWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
  }

  // ---- Initial state ----

  it("initial state: disconnected, idle, not muted", () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));
    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.audioState).toBe("idle");
    expect(result.current.isMuted).toBe(false);
  });

  it("exposes avatarSdpCallbackRef", () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));
    expect(result.current.avatarSdpCallbackRef).toBeDefined();
    expect(result.current.avatarSdpCallbackRef.current).toBeNull();
  });

  // ---- Authentication ----

  it("connect() appends JWT token from localStorage to WebSocket URL", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      const promise = result.current.connect("hcp-auth-test");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();

      // Verify token is in the URL
      expect(ws.url).toContain("?token=test-jwt-token-123");
      expect(ws.url).toMatch(
        /ws:\/\/localhost(:\d+)?\/api\/v1\/voice-live\/ws\?token=test-jwt-token-123/,
      );

      // Complete the connection to avoid timeout
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({
        type: "proxy.connected",
        model: "gpt-4o",
        avatar_enabled: false,
      });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });
  });

  it("connect() sends empty token when no access_token in localStorage", async () => {
    delete mockLocalStorage["access_token"];
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      const promise = result.current.connect("hcp-no-token");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();

      // URL should still have token param but empty value
      expect(ws.url).toContain("?token=");

      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({
        type: "proxy.connected",
        model: "gpt-4o",
        avatar_enabled: false,
      });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });
  });

  // ---- connect() ----

  it("connect() opens WebSocket and sends session.update", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    const connectPromise = act(async () => {
      const promise = result.current.connect("hcp-123", "Test prompt");

      // Wait for WebSocket open
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();

      // Simulate open + message flow
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));

      const sent = JSON.parse(ws.sentMessages[0]!);
      expect(sent.type).toBe("session.update");
      expect(sent.session.hcp_profile_id).toBe("hcp-123");
      expect(sent.session.system_prompt).toBe("Test prompt");

      // Simulate proxy.connected
      ws.simulateMessage({
        type: "proxy.connected",
        model: "gpt-4o",
        avatar_enabled: false,
      });

      // Simulate session.updated
      ws.simulateMessage({
        type: "session.updated",
        session: {},
      });

      return promise;
    });

    const connectResult = await connectPromise;
    expect(connectResult).toEqual({
      model: "gpt-4o",
      avatarEnabled: false,
      iceServers: [],
    });
    expect(result.current.connectionState).toBe("connected");
  });

  it("connect() returns ICE servers from session.updated avatar config", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    const connectResult = await act(async () => {
      const promise = result.current.connect("hcp-456");

      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));

      ws.simulateMessage({
        type: "proxy.connected",
        model: "gpt-4o",
        avatar_enabled: true,
      });

      ws.simulateMessage({
        type: "session.updated",
        session: {
          avatar: {
            ice_servers: [
              {
                urls: ["turn:relay.azure.com:3478"],
                username: "u",
                credential: "c",
              },
            ],
          },
        },
      });

      return promise;
    });

    expect(connectResult.model).toBe("gpt-4o");
    expect(connectResult.avatarEnabled).toBe(true);
    expect(connectResult.iceServers).toEqual([
      { urls: ["turn:relay.azure.com:3478"], username: "u", credential: "c" },
    ]);
  });

  it("connect() calls onConnectionStateChange with connecting then connected", async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onConnectionStateChange }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));

      expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");

      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });

      return promise;
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
  });

  // ---- Event handling ----

  it("handles user transcript events", async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onTranscript }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    act(() => {
      ws.simulateMessage({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "Hello HCP",
      });
    });

    expect(onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        content: "Hello HCP",
        isFinal: true,
      }),
    );
  });

  it("handles assistant audio transcript events", async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onTranscript }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    act(() => {
      ws.simulateMessage({
        type: "response.audio_transcript.done",
        response_id: "r1",
        item_id: "i1",
        transcript: "Response text",
      });
    });

    expect(onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: "Response text",
        isFinal: true,
      }),
    );
  });

  it("handles avatar SDP answer via callback ref", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));
    const sdpCallback = vi.fn();
    result.current.avatarSdpCallbackRef.current = sdpCallback;

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: true });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    act(() => {
      ws.simulateMessage({
        type: "session.avatar.connecting",
        server_sdp: "answer-sdp-456",
      });
    });

    expect(sdpCallback).toHaveBeenCalledWith("answer-sdp-456");
  });

  it("handles audio state transitions", async () => {
    const onAudioStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onAudioStateChange }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();

    act(() => ws.simulateMessage({ type: "input_audio_buffer.speech_started" }));
    expect(result.current.audioState).toBe("listening");
    expect(onAudioStateChange).toHaveBeenCalledWith("listening");

    act(() => ws.simulateMessage({ type: "response.created" }));
    expect(result.current.audioState).toBe("speaking");

    act(() => ws.simulateMessage({ type: "response.done" }));
    expect(result.current.audioState).toBe("idle");
  });

  it("handles error events from server", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    act(() => {
      ws.simulateMessage({
        type: "error",
        error: { message: "Server error occurred" },
      });
    });

    expect(result.current.connectionState).toBe("error");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Server error occurred" }),
    );
  });

  // ---- disconnect() ----

  it("disconnect() closes WebSocket and resets state", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.isMuted).toBe(false);
    expect(result.current.audioState).toBe("idle");
  });

  // ---- toggleMute() ----

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

  // ---- sendTextMessage() ----

  it("sendTextMessage() sends conversation.item.create and response.create", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    ws.sentMessages = []; // Clear previous messages

    await act(async () => {
      await result.current.sendTextMessage("Hello");
    });

    expect(ws.sentMessages.length).toBe(2);
    const msg1 = JSON.parse(ws.sentMessages[0]!);
    expect(msg1.type).toBe("conversation.item.create");
    expect(msg1.item.content[0].text).toBe("Hello");

    const msg2 = JSON.parse(ws.sentMessages[1]!);
    expect(msg2.type).toBe("response.create");
  });

  // ---- sendAudio() ----

  it("sendAudio() sends input_audio_buffer.append message", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    ws.sentMessages = [];

    act(() => {
      result.current.sendAudio("dGVzdA==");
    });

    expect(ws.sentMessages.length).toBe(1);
    const msg = JSON.parse(ws.sentMessages[0]!);
    expect(msg.type).toBe("input_audio_buffer.append");
    expect(msg.audio).toBe("dGVzdA==");
  });

  // ---- send() ----

  it("send() sends arbitrary messages via WebSocket", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    ws.sentMessages = [];

    act(() => {
      result.current.send({ type: "session.avatar.connect", client_sdp: "offer-sdp" });
    });

    expect(ws.sentMessages.length).toBe(1);
    const msg = JSON.parse(ws.sentMessages[0]!);
    expect(msg.type).toBe("session.avatar.connect");
    expect(msg.client_sdp).toBe("offer-sdp");
  });

  // ---- JSON parse protection ----

  it("ignores non-JSON WebSocket messages without crashing", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onError }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-1");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    const ws = getLastWs();
    // Send raw non-JSON text — should not throw
    act(() => {
      ws.onmessage?.({ data: "not valid json {{{" });
    });

    // Connection should still be fine
    expect(result.current.connectionState).toBe("connected");
    expect(onError).not.toHaveBeenCalled();
  });

  // ---- Reconnection ----

  it("attempts auto-reconnect on unexpected disconnect", async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onConnectionStateChange }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-reconnect");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    expect(result.current.connectionState).toBe("connected");
    const ws = getLastWs();

    // Simulate unexpected close (server-side)
    act(() => {
      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose?.();
    });

    // Should transition to "connecting" for reconnect
    expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");
  });

  it("does not auto-reconnect after intentional disconnect()", async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useVoiceLive({ ...defaultOptions, onConnectionStateChange }),
    );

    await act(async () => {
      const promise = result.current.connect("hcp-no-reconnect");
      await vi.waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
      const ws = getLastWs();
      await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));
      ws.simulateMessage({ type: "proxy.connected", model: "gpt-4o", avatar_enabled: false });
      ws.simulateMessage({ type: "session.updated", session: {} });
      return promise;
    });

    // Intentional disconnect
    await act(async () => {
      await result.current.disconnect();
    });

    onConnectionStateChange.mockClear();

    // Should NOT see "connecting" after intentional disconnect
    expect(result.current.connectionState).toBe("disconnected");
    expect(onConnectionStateChange).not.toHaveBeenCalledWith("connecting");
  });
});
