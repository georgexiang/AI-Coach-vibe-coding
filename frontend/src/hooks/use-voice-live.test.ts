import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceLive } from "./use-voice-live";

const mockConfigure = vi.fn().mockResolvedValue({});
const mockClose = vi.fn().mockResolvedValue(undefined);
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
    sendItem: vi.fn(),
    generateResponse: vi.fn(),
  })),
}));

const defaultOptions = {
  language: "zh-CN",
  systemPrompt: "You are a test HCP",
};

describe("useVoiceLive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      await result.current.connect({
        endpoint: "wss://test.api.cognitive.microsoft.com",
        token: "test-token",
        region: "eastus2",
        model: "gpt-4o-realtime",
        avatar_enabled: false,
        avatar_character: "",
        voice_name: "en-US-JennyNeural",
      });
    });

    expect(result.current.connectionState).toBe("connected");
    expect(onConnectionStateChange).toHaveBeenCalledWith("connecting");
    expect(onConnectionStateChange).toHaveBeenCalledWith("connected");
  });

  it("connect() with avatar_enabled adds avatar config", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect({
        endpoint: "wss://test.api.cognitive.microsoft.com",
        token: "test-token",
        region: "eastus2",
        model: "gpt-4o-realtime",
        avatar_enabled: true,
        avatar_character: "lisa",
        voice_name: "en-US-JennyNeural",
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
          endpoint: "wss://bad-endpoint",
          token: "token",
          region: "eastus2",
          model: "gpt-4o",
          avatar_enabled: false,
          avatar_character: "",
          voice_name: "en-US-JennyNeural",
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

  it("disconnect() resets state", async () => {
    const { result } = renderHook(() => useVoiceLive(defaultOptions));

    await act(async () => {
      await result.current.connect({
        endpoint: "wss://test.api.cognitive.microsoft.com",
        token: "test-token",
        region: "eastus2",
        model: "gpt-4o-realtime",
        avatar_enabled: false,
        avatar_character: "",
        voice_name: "en-US-JennyNeural",
      });
    });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.isMuted).toBe(false);
    expect(result.current.audioState).toBe("idle");
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
    // No error thrown, no client calls
  });
});
