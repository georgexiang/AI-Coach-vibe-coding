import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/api/speech", () => ({
  transcribeAudio: vi.fn(),
  synthesizeSpeech: vi.fn(),
}));

import { synthesizeSpeech } from "@/api/speech";
import { useSpeechInput, useTextToSpeech } from "./use-speech";

// Mock MediaRecorder
class MockMediaRecorder {
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
  static isTypeSupported() {
    return true;
  }
}

const mockStream = {
  getTracks: () => [{ stop: vi.fn() }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    },
    writable: true,
    configurable: true,
  });
});

describe("useSpeechInput", () => {
  it("initial state: recordingState idle, error null", () => {
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));
    expect(result.current.recordingState).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("startRecording requests microphone and sets state to recording", async () => {
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));
    await act(async () => {
      await result.current.startRecording();
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(result.current.recordingState).toBe("recording");
  });

  it("stopRecording when not recording does nothing", () => {
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));
    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.recordingState).toBe("idle");
  });

  it("handles microphone access error gracefully", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("NotAllowedError"),
    );
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBe("NotAllowedError");
    expect(result.current.recordingState).toBe("idle");
  });
});

describe("useTextToSpeech", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "Audio",
      vi.fn(() => ({
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        onended: null,
        onerror: null,
      })),
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("initial state: isSpeaking false", () => {
    const { result } = renderHook(() => useTextToSpeech());
    expect(result.current.isSpeaking).toBe(false);
  });

  it("speak calls synthesizeSpeech and creates Audio", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new Blob(["audio"]));
    const { result } = renderHook(() => useTextToSpeech("en-US"));
    await act(async () => {
      await result.current.speak("hello");
    });
    expect(synthesizeSpeech).toHaveBeenCalledWith("hello", "en-US", undefined);
  });

  it("speak with empty text does nothing", async () => {
    const { result } = renderHook(() => useTextToSpeech());
    await act(async () => {
      await result.current.speak("   ");
    });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("stop sets isSpeaking to false", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new Blob(["audio"]));
    const { result } = renderHook(() => useTextToSpeech());
    await act(async () => {
      await result.current.speak("test");
    });
    act(() => {
      result.current.stop();
    });
    expect(result.current.isSpeaking).toBe(false);
  });
});
