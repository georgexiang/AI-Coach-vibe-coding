import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioRecorder } from "./use-audio-recorder";

// Mock MediaRecorder
class MockMediaRecorder {
  state: string = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType: string;

  constructor(_stream: MediaStream, options?: { mimeType: string }) {
    this.mimeType = options?.mimeType || "audio/webm";
  }

  start(_timeslice?: number) {
    this.state = "recording";
  }

  pause() {
    this.state = "paused";
  }

  resume() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    // Simulate data available
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(["chunk"], { type: "audio/webm" }) });
    }
    // Trigger onstop asynchronously
    setTimeout(() => this.onstop?.(), 0);
  }

  static isTypeSupported(mimeType: string) {
    return mimeType === "audio/webm;codecs=opus";
  }
}

const mockTracks = [{ stop: vi.fn() }];
const mockStream = {
  getTracks: () => mockTracks,
  clone: () => ({
    getTracks: () => [{ stop: vi.fn() }],
  }),
} as unknown as MediaStream;

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

describe("useAudioRecorder", () => {
  it("initial state: not recording, no data", () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.state.isRecording).toBe(false);
    expect(result.current.state.isPaused).toBe(false);
    expect(result.current.state.duration).toBe(0);
    expect(result.current.state.hasData).toBe(false);
  });

  it("startRecording with existing stream uses clone", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.startRecording(mockStream);
    });

    expect(success).toBe(true);
    expect(result.current.state.isRecording).toBe(true);
    expect(result.current.state.isPaused).toBe(false);
  });

  it("startRecording without stream requests getUserMedia", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.state.isRecording).toBe(true);
  });

  it("startRecording returns false on getUserMedia failure", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Permission denied"),
    );

    const { result } = renderHook(() => useAudioRecorder());
    let success: boolean = true;
    await act(async () => {
      success = await result.current.startRecording();
    });

    expect(success).toBe(false);
    expect(result.current.state.isRecording).toBe(false);
  });

  it("pauseRecording sets isPaused when recording", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording(mockStream);
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.state.isPaused).toBe(true);
  });

  it("pauseRecording does nothing when not recording", () => {
    const { result } = renderHook(() => useAudioRecorder());

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.state.isPaused).toBe(false);
  });

  it("resumeRecording clears isPaused when paused", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording(mockStream);
    });
    act(() => {
      result.current.pauseRecording();
    });
    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.state.isPaused).toBe(false);
  });

  it("resumeRecording does nothing when not paused", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording(mockStream);
    });
    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.state.isRecording).toBe(true);
    expect(result.current.state.isPaused).toBe(false);
  });

  it("stopAndGetBlob returns blob and resets state", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording(mockStream);
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stopAndGetBlob();
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(result.current.state.isRecording).toBe(false);
    expect(result.current.state.hasData).toBe(true);
  });

  it("stopAndGetBlob returns null when no data recorded", async () => {
    // Create a recorder that does NOT produce data
    class EmptyMediaRecorder extends MockMediaRecorder {
      stop() {
        this.state = "inactive";
        // No ondataavailable call
        setTimeout(() => this.onstop?.(), 0);
      }
    }
    vi.stubGlobal("MediaRecorder", EmptyMediaRecorder);

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.startRecording(mockStream);
    });

    let blob: Blob | null = new Blob();
    await act(async () => {
      blob = await result.current.stopAndGetBlob();
    });

    expect(blob).toBeNull();
  });

  it("stopAndGetBlob resolves existing chunks when already inactive", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    // Never started recording, so recorder is null
    let blob: Blob | null = new Blob();
    await act(async () => {
      blob = await result.current.stopAndGetBlob();
    });

    expect(blob).toBeNull();
  });

  it("reset clears all state", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording(mockStream);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.isRecording).toBe(false);
    expect(result.current.state.isPaused).toBe(false);
    expect(result.current.state.hasData).toBe(false);
    expect(result.current.state.duration).toBe(0);
  });
});
