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
    ontrack: null,
    onicegatheringstatechange: null,
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
});
