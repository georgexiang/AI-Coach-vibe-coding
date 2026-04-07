import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock voice-logger
vi.mock("@/lib/voice-logger", () => ({
  createVoiceLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    event: vi.fn(),
  }),
}));

import { useAudioPlayer } from "./use-audio-player";

// ── AudioContext mock ────────────────────────────────────────────────────

const mockConnect = vi.fn();
const mockStart = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockCreateBuffer = vi.fn();
const mockCreateBufferSource = vi.fn();
const mockGetChannelData = vi.fn().mockReturnValue({ set: vi.fn() });

function createMockAudioContext(overrides: Record<string, unknown> = {}) {
  const ctx = {
    sampleRate: 24000,
    currentTime: 0,
    state: "running" as AudioContextState,
    destination: {},
    close: mockClose,
    resume: mockResume,
    createBuffer: mockCreateBuffer.mockReturnValue({
      duration: 0.5,
      getChannelData: mockGetChannelData,
    }),
    createBufferSource: mockCreateBufferSource.mockReturnValue({
      buffer: null,
      connect: mockConnect,
      start: mockStart,
    }),
    ...overrides,
  };
  return ctx;
}

let mockAudioCtx: ReturnType<typeof createMockAudioContext> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mockAudioCtx = null;

  // Global AudioContext constructor mock
  vi.stubGlobal(
    "AudioContext",
    vi.fn().mockImplementation((opts?: AudioContextOptions) => {
      mockAudioCtx = createMockAudioContext({
        sampleRate: opts?.sampleRate ?? 24000,
      });
      return mockAudioCtx;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Helper: create a valid base64-encoded PCM16 audio chunk (4 bytes = 2 samples)
function makeBase64Pcm16(): string {
  const int16 = new Int16Array([1000, -2000]);
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

describe("useAudioPlayer", () => {
  it("returns playAudio and stopAudio functions", () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(typeof result.current.playAudio).toBe("function");
    expect(typeof result.current.stopAudio).toBe("function");
  });

  it("creates AudioContext lazily on first playAudio call", () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(AudioContext).not.toHaveBeenCalled();

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    expect(AudioContext).toHaveBeenCalledWith({ sampleRate: 24000 });
  });

  it("reuses AudioContext on subsequent playAudio calls", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
      result.current.playAudio(makeBase64Pcm16());
    });

    expect(AudioContext).toHaveBeenCalledTimes(1);
  });

  it("decodes base64, creates buffer, and schedules playback", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    // Should create an AudioBuffer with 2 samples (4 bytes PCM16 = 2 Int16 samples)
    expect(mockCreateBuffer).toHaveBeenCalledWith(1, 2, 24000);
    expect(mockGetChannelData).toHaveBeenCalledWith(0);
    expect(mockCreateBufferSource).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledWith(mockAudioCtx!.destination);
    expect(mockStart).toHaveBeenCalled();
  });

  it("resumes a suspended AudioContext", () => {
    vi.mocked(AudioContext).mockImplementation(() => {
      mockAudioCtx = createMockAudioContext({ state: "suspended" });
      return mockAudioCtx as unknown as AudioContext;
    });

    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    expect(mockResume).toHaveBeenCalled();
  });

  it("does not resume a running AudioContext", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    expect(mockResume).not.toHaveBeenCalled();
  });

  it("schedules gapless playback (next chunk starts after previous ends)", () => {
    const startTimes: number[] = [];

    // Override the global AudioContext mock to capture start times
    vi.mocked(AudioContext).mockImplementation(() => {
      mockAudioCtx = {
        sampleRate: 24000,
        currentTime: 0,
        state: "running" as AudioContextState,
        destination: {},
        close: mockClose,
        resume: mockResume,
        createBuffer: vi.fn().mockReturnValue({
          duration: 0.5,
          getChannelData: vi.fn().mockReturnValue({ set: vi.fn() }),
        }),
        createBufferSource: vi.fn().mockImplementation(() => ({
          buffer: null,
          connect: mockConnect,
          start: (time: number) => {
            startTimes.push(time);
          },
        })),
      } as unknown as ReturnType<typeof createMockAudioContext>;
      return mockAudioCtx as unknown as AudioContext;
    });

    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
      result.current.playAudio(makeBase64Pcm16());
    });

    // Second chunk should start at first start time + duration (0.5)
    expect(startTimes.length).toBe(2);
    expect(startTimes[1]).toBeCloseTo(startTimes[0]! + 0.5, 5);
  });

  it("stopAudio closes AudioContext and resets state", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    expect(mockAudioCtx).not.toBeNull();

    act(() => {
      result.current.stopAudio();
    });

    expect(mockClose).toHaveBeenCalled();
  });

  it("stopAudio is safe to call without prior playAudio", () => {
    const { result } = renderHook(() => useAudioPlayer());

    // Should not throw
    act(() => {
      result.current.stopAudio();
    });

    expect(mockClose).not.toHaveBeenCalled();
  });

  it("playAudio creates a new AudioContext after stopAudio", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    act(() => {
      result.current.stopAudio();
    });

    act(() => {
      result.current.playAudio(makeBase64Pcm16());
    });

    // Two AudioContext creations: one before stop, one after
    expect(AudioContext).toHaveBeenCalledTimes(2);
  });
});
