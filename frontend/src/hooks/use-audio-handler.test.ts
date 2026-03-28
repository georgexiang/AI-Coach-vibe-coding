import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioHandler } from "./use-audio-handler";

const mockAnalyser = {
  fftSize: 0,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn(),
  connect: vi.fn(),
};
const mockSource = { connect: vi.fn() };
const mockWorkletNode = {
  connect: vi.fn(),
  port: { postMessage: vi.fn(), onmessage: null as ((e: MessageEvent) => void) | null },
};
const mockAudioContext = {
  audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
  createMediaStreamSource: vi.fn(() => mockSource),
  createAnalyser: vi.fn(() => mockAnalyser),
  destination: {},
  close: vi.fn().mockResolvedValue(undefined),
  sampleRate: 24000,
};

const mockTracks = [{ stop: vi.fn() }];
const mockStream = { getTracks: () => mockTracks };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("AudioContext", vi.fn(() => mockAudioContext));
  vi.stubGlobal("AudioWorkletNode", vi.fn(() => mockWorkletNode));
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    },
    writable: true,
    configurable: true,
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

describe("useAudioHandler", () => {
  it("initial state: not recording, no analyser data", () => {
    const { result } = renderHook(() => useAudioHandler());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.analyserData).toBeNull();
  });

  it("initialize() creates AudioContext and worklet node", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });
    expect(AudioContext).toHaveBeenCalledWith({ sampleRate: 24000 });
    expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith(
      "/audio-processor.js",
    );
    expect(AudioWorkletNode).toHaveBeenCalled();
  });

  it("startRecording posts START_RECORDING and sets isRecording", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });
    const onAudioData = vi.fn();
    act(() => {
      result.current.startRecording(onAudioData);
    });
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      command: "START_RECORDING",
    });
    expect(result.current.isRecording).toBe(true);
  });

  it("stopRecording posts STOP_RECORDING and resets state", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });
    act(() => {
      result.current.startRecording(vi.fn());
    });
    act(() => {
      result.current.stopRecording();
    });
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      command: "STOP_RECORDING",
    });
    expect(result.current.isRecording).toBe(false);
  });

  it("cleanup stops tracks and closes AudioContext", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });
    act(() => {
      result.current.cleanup();
    });
    expect(mockTracks[0]!.stop).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });
});
