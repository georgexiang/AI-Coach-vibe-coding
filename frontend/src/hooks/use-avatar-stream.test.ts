import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAvatarStream } from "./use-avatar-stream";

let mockPc: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();

  mockPc = {
    addTransceiver: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ sdp: "mock-sdp", type: "offer" }),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    createDataChannel: vi.fn(),
    localDescription: { sdp: "mock-sdp", type: "offer" },
    ontrack: null as ((event: unknown) => void) | null,
    onicecandidate: null as ((event: unknown) => void) | null,
  };
  vi.stubGlobal("RTCPeerConnection", vi.fn(() => mockPc));
});

afterEach(() => {
  // Clean up any audio elements appended to body by the hook
  document.querySelectorAll("audio").forEach((el) => el.remove());
});

/** Base64 encode SDP the way Azure expects it. */
function encodeAzureSdp(type: string, sdp: string): string {
  return btoa(JSON.stringify({ type, sdp }));
}

/**
 * Helper: creates sendSdpOffer that auto-resolves with base64-encoded server SDP.
 * triggerIceComplete waits for onicecandidate to be set, then fires it.
 */
function createMockSdpExchange(handleServerSdp: (sdp: string) => Promise<void>) {
  const sentSdps: string[] = [];
  const sendSdpOffer = vi.fn(async (sdp: string) => {
    sentSdps.push(sdp);
    // Simulate server answering with base64-encoded SDP
    const answerSdp = encodeAzureSdp("answer", "answer-sdp-raw");
    await handleServerSdp(answerSdp);
  });

  /** Fire onicecandidate(null) — must be called after handler is set. */
  function triggerIceComplete() {
    const handler = mockPc.onicecandidate as ((ev: unknown) => void) | null;
    handler?.({ candidate: null });
  }

  return { sendSdpOffer, sentSdps, triggerIceComplete };
}

/** Wait for onicecandidate to be assigned then trigger ICE complete. */
async function waitAndTriggerIce(triggerIceComplete: () => void) {
  await vi.waitFor(() => expect(mockPc.onicecandidate).toBeTruthy());
  triggerIceComplete();
}

/** Create a mock video element with play() method. */
function createMockVideoElement(): HTMLVideoElement {
  const video = document.createElement("video");
  // Mock play() since jsdom doesn't support it
  video.play = vi.fn().mockResolvedValue(undefined);
  return video;
}

describe("useAvatarStream", () => {
  it("initial state: isConnected false", () => {
    const ref = { current: null } as React.RefObject<HTMLVideoElement | null>;
    const { result } = renderHook(() => useAvatarStream(ref));
    expect(result.current.isConnected).toBe(false);
  });

  it("connect() creates RTCPeerConnection and does base64 SDP exchange", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const connectPromise = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await connectPromise;
    });

    expect(RTCPeerConnection).toHaveBeenCalled();
    expect(mockPc.createOffer).toHaveBeenCalled();
    expect(mockPc.setLocalDescription).toHaveBeenCalled();

    // SDP offer must be base64-encoded JSON (Azure format)
    const expectedEncodedSdp = encodeAzureSdp("offer", "mock-sdp");
    expect(sendSdpOffer).toHaveBeenCalledWith(expectedEncodedSdp);

    // Server SDP answer is decoded from base64 JSON to raw SDP
    expect(mockPc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp-raw",
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("handleServerSdp decodes base64 JSON SDP answer", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    expect(mockPc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp-raw",
    });
  });

  it("handleServerSdp falls back to raw SDP if not base64 JSON", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));

    // Override: send raw SDP instead of base64
    const sendSdpOffer = vi.fn(async () => {
      await result.current.handleServerSdp("raw-sdp-answer");
    });

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await vi.waitFor(() => expect(mockPc.onicecandidate).toBeTruthy());
      const handler = mockPc.onicecandidate as (ev: unknown) => void;
      handler({ candidate: null });
      await p;
    });

    expect(mockPc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "raw-sdp-answer",
    });
  });

  it("disconnect() closes connection and clears video srcObject", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    act(() => {
      result.current.disconnect();
    });

    expect(mockPc.close).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it("disconnect() when not connected is safe", () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));

    act(() => {
      result.current.disconnect();
    });

    expect(video.srcObject).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it("disconnect() when video ref is null is safe", () => {
    const ref = { current: null } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("ontrack sets video srcObject and calls play()", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;
    expect(ontrack).toBeTruthy();

    const mockMediaStream = {};
    act(() => {
      ontrack({
        track: { kind: "video" },
        streams: [mockMediaStream],
      });
    });

    // Video srcObject should be set on the ref element
    expect(video.srcObject).toBe(mockMediaStream);
    // play() should be called explicitly
    expect(video.play).toHaveBeenCalled();
  });

  it("ontrack creates hidden audio element on document.body", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;
    const mockAudioStream = {};

    act(() => {
      ontrack({
        track: { kind: "audio" },
        streams: [mockAudioStream],
      });
    });

    // Audio element should be appended to document.body
    const audioEl = document.querySelector("audio");
    expect(audioEl).toBeTruthy();
    expect(audioEl?.srcObject).toBe(mockAudioStream);
    expect(audioEl?.autoplay).toBe(true);
    expect(audioEl?.style.display).toBe("none");
  });

  it("ontrack handles empty streams array using null", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;

    act(() => {
      ontrack({ track: { kind: "video" }, streams: [] });
    });

    expect(video.srcObject).toBeNull();
  });

  it("ontrack does nothing for video when videoRef.current is null", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.MutableRefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;
    ref.current = null;

    act(() => {
      ontrack({ track: { kind: "video" }, streams: [{}] });
    });
    // No error thrown, video not assigned
  });

  it("connect() adds recvonly transceivers", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    expect(mockPc.addTransceiver).toHaveBeenCalledWith("video", {
      direction: "recvonly",
    });
    expect(mockPc.addTransceiver).toHaveBeenCalledWith("audio", {
      direction: "recvonly",
    });
  });

  it("connect() passes ICE servers and bundlePolicy to RTCPeerConnection", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.azure.com:3478" },
      { urls: "turn:turn.azure.com:3478", username: "user", credential: "pass" },
    ];

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect(iceServers, sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({
      iceServers,
      bundlePolicy: "max-bundle",
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("connect() with empty ICE servers uses undefined config", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({
      iceServers: undefined,
      bundlePolicy: "max-bundle",
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("connect() with Azure TURN ICE servers passes credentials", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const azureIceServers: RTCIceServer[] = [
      {
        urls: "turn:relay.communication.microsoft.com:3478",
        username: "azure-turn-user",
        credential: "azure-turn-credential",
      },
    ];

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect(azureIceServers, sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({
      iceServers: azureIceServers,
      bundlePolicy: "max-bundle",
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("disconnect() removes dynamically created audio element from body", async () => {
    const video = createMockVideoElement();
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    // Simulate audio track arriving
    const ontrack = mockPc.ontrack as (event: unknown) => void;
    act(() => {
      ontrack({
        track: { kind: "audio" },
        streams: [{}],
      });
    });

    // Audio element should exist in body
    expect(document.querySelector("audio")).toBeTruthy();

    // Disconnect should remove it
    act(() => {
      result.current.disconnect();
    });

    expect(document.querySelector("audio")).toBeNull();
  });

  it("connect() resets video srcObject before new connection", async () => {
    const video = createMockVideoElement();
    video.srcObject = {} as MediaStream; // Simulate previous stream
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      // At this point srcObject should be reset to null
      expect(video.srcObject).toBeNull();
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });
  });

  it("ontrack video play() failure is caught gracefully", async () => {
    const video = createMockVideoElement();
    (video.play as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("play() not allowed"),
    );
    const ref = { current: video } as React.RefObject<HTMLVideoElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));
    const { sendSdpOffer, triggerIceComplete } = createMockSdpExchange(
      result.current.handleServerSdp,
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await act(async () => {
      const p = result.current.connect([], sendSdpOffer);
      await waitAndTriggerIce(triggerIceComplete);
      await p;
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;
    await act(async () => {
      ontrack({
        track: { kind: "video" },
        streams: [{}],
      });
      // Wait for the play() rejection to be handled
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[AvatarStream] Video play() failed:",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
