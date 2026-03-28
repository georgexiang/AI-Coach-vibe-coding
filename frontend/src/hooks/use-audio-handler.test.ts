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
  vi.stubGlobal("requestAnimationFrame", vi.fn((_cb: () => void) => {
    // Return a unique ID; don't auto-call the callback
    return 42;
  }));
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

  it("initialize() returns ctx, workletNode, and analyser", async () => {
    const { result } = renderHook(() => useAudioHandler());
    let returned: unknown;
    await act(async () => {
      returned = await result.current.initialize();
    });
    const ret = returned as { ctx: unknown; workletNode: unknown; analyser: unknown };
    expect(ret.ctx).toBe(mockAudioContext);
    expect(ret.workletNode).toBe(mockWorkletNode);
    expect(ret.analyser).toBe(mockAnalyser);
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

  it("startRecording does nothing when workletNode is not initialized", () => {
    const { result } = renderHook(() => useAudioHandler());
    const onAudioData = vi.fn();
    act(() => {
      result.current.startRecording(onAudioData);
    });
    // Should not throw and not set isRecording
    expect(result.current.isRecording).toBe(false);
    expect(mockWorkletNode.port.postMessage).not.toHaveBeenCalled();
  });

  it("startRecording sets up onmessage handler that calls onAudioData for audio events", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });

    const onAudioData = vi.fn();
    act(() => {
      result.current.startRecording(onAudioData);
    });

    // Simulate audio message via the worklet port
    const audioData = new Float32Array([0.1, 0.2, 0.3]);
    act(() => {
      mockWorkletNode.port.onmessage?.({
        data: { eventType: "audio", audioData },
      } as MessageEvent);
    });

    expect(onAudioData).toHaveBeenCalledWith(audioData);
  });

  it("startRecording onmessage handler ignores non-audio events", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });

    const onAudioData = vi.fn();
    act(() => {
      result.current.startRecording(onAudioData);
    });

    // Simulate non-audio message
    act(() => {
      mockWorkletNode.port.onmessage?.({
        data: { eventType: "other", someData: "value" },
      } as MessageEvent);
    });

    expect(onAudioData).not.toHaveBeenCalled();
  });

  it("startRecording onmessage handler ignores audio events without audioData", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });

    const onAudioData = vi.fn();
    act(() => {
      result.current.startRecording(onAudioData);
    });

    // audio event but no audioData
    act(() => {
      mockWorkletNode.port.onmessage?.({
        data: { eventType: "audio" },
      } as MessageEvent);
    });

    expect(onAudioData).not.toHaveBeenCalled();
  });

  it("startRecording kicks off analyser animation loop", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });

    const onAudioData = vi.fn();
    act(() => {
      result.current.startRecording(onAudioData);
    });

    // requestAnimationFrame should have been called (the updateAnalyser runs once immediately)
    expect(requestAnimationFrame).toHaveBeenCalled();
    // getByteFrequencyData should have been called in the initial run
    expect(mockAnalyser.getByteFrequencyData).toHaveBeenCalled();
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
    expect(result.current.analyserData).toBeNull();
  });

  it("stopRecording cancels animation frame", async () => {
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
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("stopRecording is safe when not recording", () => {
    const { result } = renderHook(() => useAudioHandler());
    act(() => {
      result.current.stopRecording();
    });
    // Should not throw
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

  it("cleanup also stops recording first", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });
    act(() => {
      result.current.startRecording(vi.fn());
    });
    act(() => {
      result.current.cleanup();
    });

    // stopRecording should have been called internally
    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      command: "STOP_RECORDING",
    });
    expect(result.current.isRecording).toBe(false);
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it("cleanup is safe when not initialized", () => {
    const { result } = renderHook(() => useAudioHandler());
    act(() => {
      result.current.cleanup();
    });
    // Should not throw
    expect(result.current.isRecording).toBe(false);
  });

  it("exposes analyserRef", () => {
    const { result } = renderHook(() => useAudioHandler());
    expect(result.current.analyserRef).toBeDefined();
    expect(result.current.analyserRef.current).toBeNull();
  });

  it("analyserRef is set after initialize", async () => {
    const { result } = renderHook(() => useAudioHandler());
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.analyserRef.current).toBe(mockAnalyser);
  });
});
