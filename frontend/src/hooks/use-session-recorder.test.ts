import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionRecorder } from "./use-session-recorder";

// Mock useAudioRecorder
const mockStartRecording = vi.fn().mockResolvedValue(true);
const mockStopAndGetBlob = vi.fn().mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
const mockReset = vi.fn();

vi.mock("./use-audio-recorder", () => ({
  useAudioRecorder: () => ({
    state: { isRecording: false, isPaused: false, duration: 0, hasData: false },
    startRecording: mockStartRecording,
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    stopAndGetBlob: mockStopAndGetBlob,
    reset: mockReset,
  }),
}));

// Mock uploadSessionAudio
const mockUploadSessionAudio = vi.fn().mockResolvedValue({ audio_url: "/audio/test.webm" });

vi.mock("@/api/unified-session", () => ({
  uploadSessionAudio: (...args: unknown[]) => mockUploadSessionAudio(...args),
}));

describe("useSessionRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initial state: not recording", () => {
    const { result } = renderHook(() => useSessionRecorder());
    expect(result.current.isRecording).toBe(false);
  });

  it("startRecording delegates to useAudioRecorder with the stream", async () => {
    const { result } = renderHook(() => useSessionRecorder());
    const mockStream = { getTracks: () => [] } as unknown as MediaStream;

    let success: boolean = false;
    await act(async () => {
      success = await result.current.startRecording(mockStream);
    });

    expect(success).toBe(true);
    expect(mockStartRecording).toHaveBeenCalledWith(mockStream);
  });

  it("startRecording returns false when recorder fails", async () => {
    mockStartRecording.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useSessionRecorder());
    const mockStream = { getTracks: () => [] } as unknown as MediaStream;

    let success: boolean = true;
    await act(async () => {
      success = await result.current.startRecording(mockStream);
    });

    expect(success).toBe(false);
  });

  it("stopAndUpload stops recording and uploads the blob", async () => {
    const { result } = renderHook(() => useSessionRecorder());

    let uploadResult: { success: boolean; error?: string } = { success: false };
    await act(async () => {
      uploadResult = await result.current.stopAndUpload("session-abc");
    });

    expect(uploadResult.success).toBe(true);
    expect(mockStopAndGetBlob).toHaveBeenCalled();
    expect(mockUploadSessionAudio).toHaveBeenCalledWith(
      "session-abc",
      expect.any(Blob),
      expect.stringContaining("session-abc"),
    );
    expect(mockReset).toHaveBeenCalled();
  });

  it("stopAndUpload returns error when no audio data", async () => {
    mockStopAndGetBlob.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useSessionRecorder());

    let uploadResult: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      uploadResult = await result.current.stopAndUpload("session-abc");
    });

    expect(uploadResult.success).toBe(false);
    expect(uploadResult.error).toBe("No audio data recorded");
    expect(mockUploadSessionAudio).not.toHaveBeenCalled();
  });

  it("stopAndUpload returns error when upload fails", async () => {
    mockUploadSessionAudio.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useSessionRecorder());

    let uploadResult: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      uploadResult = await result.current.stopAndUpload("session-abc");
    });

    expect(uploadResult.success).toBe(false);
    expect(uploadResult.error).toBe("Network error");
  });

  it("stopAndUpload prevents concurrent uploads", async () => {
    // Make upload take time
    let resolveUpload: (() => void) | undefined;
    mockUploadSessionAudio.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveUpload = resolve; }),
    );

    const { result } = renderHook(() => useSessionRecorder());

    // Start first upload (will be pending)
    let firstResult: { success: boolean; error?: string } = { success: false };
    const firstPromise = act(async () => {
      firstResult = await result.current.stopAndUpload("session-1");
    });

    // Try second upload immediately
    let secondResult: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      secondResult = await result.current.stopAndUpload("session-1");
    });

    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toBe("Upload already in progress");

    // Resolve first
    await act(async () => {
      resolveUpload?.();
    });
    await firstPromise;

    expect(firstResult.success).toBe(true);
  });

  it("cancel stops recording and resets without uploading", async () => {
    const { result } = renderHook(() => useSessionRecorder());

    await act(async () => {
      await result.current.cancel();
    });

    expect(mockStopAndGetBlob).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
    expect(mockUploadSessionAudio).not.toHaveBeenCalled();
  });

  it("stopAndUpload generates filename with sessionId and timestamp", async () => {
    const { result } = renderHook(() => useSessionRecorder());

    await act(async () => {
      await result.current.stopAndUpload("my-session-id");
    });

    const filename = mockUploadSessionAudio.mock.calls[0]![2] as string;
    expect(filename).toMatch(/^session-my-session-id-\d+\.webm$/);
  });
});
