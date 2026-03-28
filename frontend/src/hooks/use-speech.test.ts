import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/api/speech", () => ({
  transcribeAudio: vi.fn(),
  synthesizeSpeech: vi.fn(),
}));

import { transcribeAudio, synthesizeSpeech } from "@/api/speech";
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
  static isTypeSupported(_mimeType: string): boolean {
    return _mimeType === "audio/webm;codecs=opus";
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

  it("handles microphone access error gracefully (Error instance)", async () => {
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

  it("handles microphone access error when thrown value is not an Error", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      "raw string error",
    );
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.error).toBe("Microphone access denied");
    expect(result.current.recordingState).toBe("idle");
  });

  it("stopRecording triggers onstop and calls transcribeAudio", async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: "Hello world",
      language: "zh-CN",
    });
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    await act(async () => {
      await result.current.startRecording();
    });

    // Get the actual recorder instance from the internal ref
    // We'll trigger stop which fires onstop
    await act(async () => {
      result.current.stopRecording();
      // Wait for the transcription promise to resolve
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(transcribeAudio).toHaveBeenCalled();
    expect(onTranscribed).toHaveBeenCalledWith("Hello world");
    expect(result.current.recordingState).toBe("idle");
  });

  it("onstop calls onTranscribed only when text is non-empty", async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: "   ",
      language: "zh-CN",
    });
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(transcribeAudio).toHaveBeenCalled();
    expect(onTranscribed).not.toHaveBeenCalled();
    expect(result.current.recordingState).toBe("idle");
  });

  it("onstop handles transcription error with Error instance", async () => {
    vi.mocked(transcribeAudio).mockRejectedValueOnce(
      new Error("Transcription service down"),
    );
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Transcription service down");
    expect(result.current.recordingState).toBe("idle");
  });

  it("onstop handles transcription error with non-Error value", async () => {
    vi.mocked(transcribeAudio).mockRejectedValueOnce("something bad");
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.error).toBe("Transcription failed");
    expect(result.current.recordingState).toBe("idle");
  });

  it("uses fallback mimeType when opus is not supported", async () => {
    // Override isTypeSupported to return false for opus
    vi.stubGlobal("MediaRecorder", class extends MockMediaRecorder {
      static isTypeSupported(_mimeType: string): boolean {
        return false;
      }
    });

    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.recordingState).toBe("recording");
  });

  it("ondataavailable collects chunks with size > 0", async () => {
    // We need to intercept MediaRecorder construction to get ondataavailable
    let capturedRecorder: MockMediaRecorder | undefined;
    const OriginalMock = MockMediaRecorder;
    vi.stubGlobal("MediaRecorder", class extends OriginalMock {
      constructor(_stream: unknown, _opts: unknown) {
        super();
        capturedRecorder = this;
      }
      static isTypeSupported(mime: string): boolean {
        return OriginalMock.isTypeSupported(mime);
      }
    });

    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: "captured",
      language: "zh-CN",
    });
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    await act(async () => {
      await result.current.startRecording();
    });

    // Simulate ondataavailable with size > 0
    act(() => {
      capturedRecorder?.ondataavailable?.({ data: new Blob(["chunk1"]) });
      capturedRecorder?.ondataavailable?.({ data: new Blob([]) }); // size 0 - ignored
      capturedRecorder?.ondataavailable?.({ data: new Blob(["chunk2"]) });
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(transcribeAudio).toHaveBeenCalled();
  });

  it("passes custom language to transcribeAudio", async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: "hello",
      language: "en-US",
    });
    const onTranscribed = vi.fn();
    const { result } = renderHook(() =>
      useSpeechInput(onTranscribed, "en-US"),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(transcribeAudio).toHaveBeenCalledWith(expect.any(Blob), "en-US");
  });

  it("stopRecording does nothing when recorder state is not recording", async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      text: "x",
      language: "zh-CN",
    });
    const onTranscribed = vi.fn();
    const { result } = renderHook(() => useSpeechInput(onTranscribed));

    // Start recording and immediately stop to get to inactive state
    await act(async () => {
      await result.current.startRecording();
    });

    // First stop triggers onstop -> transcribeAudio
    act(() => {
      result.current.stopRecording();
    });

    // Second stop should be a no-op because state is already inactive
    act(() => {
      result.current.stopRecording();
    });

    // Wait for async transcription to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // No error thrown
  });
});

describe("useTextToSpeech", () => {
  let mockAudioInstance: {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
    onerror: (() => void) | null;
  };

  beforeEach(() => {
    mockAudioInstance = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      onended: null,
      onerror: null,
    };
    vi.stubGlobal("Audio", vi.fn(() => mockAudioInstance));
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

  it("speak with custom voice parameter", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new Blob(["audio"]));
    const { result } = renderHook(() =>
      useTextToSpeech("zh-CN", "zh-CN-XiaoxiaoNeural"),
    );
    await act(async () => {
      await result.current.speak("test text");
    });
    expect(synthesizeSpeech).toHaveBeenCalledWith(
      "test text",
      "zh-CN",
      "zh-CN-XiaoxiaoNeural",
    );
  });

  it("speak with empty text does nothing", async () => {
    const { result } = renderHook(() => useTextToSpeech());
    await act(async () => {
      await result.current.speak("   ");
    });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it("speak sets isSpeaking to true and audio.onended resets it", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new Blob(["audio"]));
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.speak("hello");
    });

    expect(result.current.isSpeaking).toBe(true);

    // Trigger onended
    act(() => {
      mockAudioInstance.onended?.();
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("audio.onerror resets isSpeaking and revokes URL", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new Blob(["audio"]));
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.speak("hello");
    });

    expect(result.current.isSpeaking).toBe(true);

    // Trigger onerror
    act(() => {
      mockAudioInstance.onerror?.();
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("speak stops current playback before starting new one", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValue(new Blob(["audio"]));
    const { result } = renderHook(() => useTextToSpeech());

    // First speak
    await act(async () => {
      await result.current.speak("first");
    });

    const firstAudioInstance = mockAudioInstance;

    // Create a new mock audio instance for the second speak
    const secondAudioInstance = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    (globalThis.Audio as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      secondAudioInstance,
    );

    // Second speak should pause the first
    await act(async () => {
      await result.current.speak("second");
    });

    expect(firstAudioInstance.pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("speak handles synthesizeSpeech failure", async () => {
    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(
      new Error("TTS service failed"),
    );
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.speak("fail text");
    });

    expect(result.current.isSpeaking).toBe(false);
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

  it("stop() pauses audio and revokes URL", async () => {
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce(new Blob(["audio"]));
    const { result } = renderHook(() => useTextToSpeech());

    await act(async () => {
      await result.current.speak("hello");
    });

    act(() => {
      result.current.stop();
    });

    expect(mockAudioInstance.pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(result.current.isSpeaking).toBe(false);
  });

  it("stop() when no audio is playing is safe", () => {
    const { result } = renderHook(() => useTextToSpeech());

    act(() => {
      result.current.stop();
    });

    expect(result.current.isSpeaking).toBe(false);
  });
});
