import { describe, it, expect, vi, beforeEach } from "vitest";
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
    iceGatheringState: "complete",
    localDescription: { sdp: "mock-sdp", type: "offer" },
    ontrack: null as ((event: unknown) => void) | null,
    onicegatheringstatechange: null as (() => void) | null,
  };
  vi.stubGlobal("RTCPeerConnection", vi.fn(() => mockPc));
});

describe("useAvatarStream", () => {
  it("initial state: isConnected false", () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>;
    const { result } = renderHook(() => useAvatarStream(ref));
    expect(result.current.isConnected).toBe(false);
  });

  it("connect() creates RTCPeerConnection and does SDP exchange", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({ iceServers: [] });
    expect(mockPc.createOffer).toHaveBeenCalled();
    expect(mockPc.setLocalDescription).toHaveBeenCalled();
    expect(mockRtClient.connectAvatar).toHaveBeenCalled();
    expect(mockPc.setRemoteDescription).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(true);
  });

  it("connect() throws if rtClient has no connectAvatar", async () => {
    const ref = { current: document.createElement("div") } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {}; // No connectAvatar

    const { result } = renderHook(() => useAvatarStream(ref));

    await expect(
      act(async () => {
        await result.current.connect([], mockRtClient);
      }),
    ).rejects.toThrow("RTClient does not support avatar connection");
  });

  it("disconnect() closes connection and clears container", async () => {
    const container = document.createElement("div");
    container.innerHTML = "<video id='avatar-video'></video>";
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(mockPc.close).toHaveBeenCalled();
    expect(container.innerHTML).toBe("");
    expect(result.current.isConnected).toBe(false);
  });

  it("disconnect() when not connected is safe", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>some content</p>";
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));

    act(() => {
      result.current.disconnect();
    });

    // Should still clear the container and set false
    expect(container.innerHTML).toBe("");
    expect(result.current.isConnected).toBe(false);
  });

  it("disconnect() when container ref is null is safe", async () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement | null>;

    const { result } = renderHook(() => useAvatarStream(ref));

    // We can't actually connect without a container for ontrack, but we can test disconnect
    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("ontrack adds video element to container", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    // Simulate a video track event
    const ontrack = mockPc.ontrack as (event: unknown) => void;
    expect(ontrack).toBeTruthy();

    const mockMediaStream = {};
    act(() => {
      ontrack({
        track: { kind: "video" },
        streams: [mockMediaStream],
      });
    });

    const videoEl = container.querySelector("#avatar-video");
    expect(videoEl).toBeTruthy();
    expect(videoEl?.tagName).toBe("VIDEO");
    expect((videoEl as HTMLVideoElement).autoplay).toBe(true);
    expect((videoEl as HTMLVideoElement).playsInline).toBe(true);
    expect((videoEl as HTMLVideoElement).style.width).toBe("100%");
    expect((videoEl as HTMLVideoElement).style.height).toBe("100%");
    expect((videoEl as HTMLVideoElement).style.objectFit).toBe("cover");
  });

  it("ontrack adds audio element to container", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;

    act(() => {
      ontrack({
        track: { kind: "audio" },
        streams: [{}],
      });
    });

    const audioEl = container.querySelector("#avatar-audio");
    expect(audioEl).toBeTruthy();
    expect(audioEl?.tagName).toBe("AUDIO");
    expect((audioEl as HTMLAudioElement).autoplay).toBe(true);
  });

  it("ontrack removes existing element of same type before appending", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;

    // Add first video track
    act(() => {
      ontrack({
        track: { kind: "video" },
        streams: [{}],
      });
    });

    expect(container.querySelectorAll("#avatar-video").length).toBe(1);

    // Add second video track - should replace the first
    act(() => {
      ontrack({
        track: { kind: "video" },
        streams: [{}],
      });
    });

    // Should still be only 1 video element
    expect(container.querySelectorAll("#avatar-video").length).toBe(1);
  });

  it("ontrack handles empty streams array using null", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;

    // streams[0] is undefined, so ?? null
    act(() => {
      ontrack({
        track: { kind: "video" },
        streams: [],
      });
    });

    const videoEl = container.querySelector("#avatar-video") as HTMLVideoElement;
    expect(videoEl).toBeTruthy();
    expect(videoEl.srcObject).toBeNull();
  });

  it("ontrack does nothing when videoContainerRef.current is null", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.MutableRefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    const ontrack = mockPc.ontrack as (event: unknown) => void;

    // Set ref to null before triggering ontrack
    ref.current = null;

    act(() => {
      ontrack({
        track: { kind: "video" },
        streams: [{}],
      });
    });

    // No error thrown, nothing appended
  });

  it("connect() waits for ICE gathering when not yet complete", async () => {
    // Override ICE gathering state to not be complete initially
    mockPc.iceGatheringState = "gathering";

    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    // Start connection - it will wait for ICE gathering
    const connectPromise = act(async () => {
      // Trigger onicegatheringstatechange after a delay
      setTimeout(() => {
        mockPc.iceGatheringState = "complete";
        const handler = mockPc.onicegatheringstatechange as (() => void) | null;
        handler?.();
      }, 10);

      await result.current.connect([], mockRtClient);
    });

    await connectPromise;
    expect(result.current.isConnected).toBe(true);
  });

  it("connect() resolves ICE gathering on timeout", async () => {
    // Override ICE gathering to never complete, but resolve via onicegatheringstatechange
    // after a real short delay (simulating the 5s timeout scenario by just having it never
    // fire onicegatheringstatechange). We use setTimeout within the source, so
    // we simulate the timeout resolving by waiting.
    // For this test, we set iceGatheringState to "gathering" and override setTimeout
    // to immediately call the callback:
    const originalSetTimeout = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", (cb: () => void, _ms?: number) => {
      // Immediately invoke the timeout callback
      cb();
      return 999;
    });

    mockPc.iceGatheringState = "gathering";

    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    expect(result.current.isConnected).toBe(true);

    // Restore setTimeout
    vi.stubGlobal("setTimeout", originalSetTimeout);
  });

  it("connect() adds video and audio transceivers", async () => {
    const container = document.createElement("div");
    const ref = { current: container } as React.RefObject<HTMLDivElement | null>;
    const mockRtClient = {
      connectAvatar: vi.fn().mockResolvedValue({ sdp: "answer-sdp", type: "answer" }),
    };

    const { result } = renderHook(() => useAvatarStream(ref));

    await act(async () => {
      await result.current.connect([], mockRtClient);
    });

    expect(mockPc.addTransceiver).toHaveBeenCalledWith("video", {
      direction: "sendrecv",
    });
    expect(mockPc.addTransceiver).toHaveBeenCalledWith("audio", {
      direction: "sendrecv",
    });
  });
});
