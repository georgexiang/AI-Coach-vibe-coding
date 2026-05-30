import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUnifiedSession } from "./use-unified-session";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { warning: vi.fn() },
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockGetUserMedia = vi.fn();
const mockStream = {
  getTracks: () => [{ stop: vi.fn() }],
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    },
    writable: true,
    configurable: true,
  });
  mockGetUserMedia.mockResolvedValue(mockStream);
});

describe("useUnifiedSession", () => {
  it("defaults to voice mode", () => {
    const { result } = renderHook(() => useUnifiedSession());
    expect(result.current.mode).toBe("voice");
  });

  it("accepts custom defaultMode", () => {
    const { result } = renderHook(() =>
      useUnifiedSession({ defaultMode: "text" }),
    );
    expect(result.current.mode).toBe("text");
  });

  it("initial voiceConnectionState is idle", () => {
    const { result } = renderHook(() => useUnifiedSession());
    expect(result.current.voiceConnectionState).toBe("idle");
  });

  it("initial modeTransitions is empty", () => {
    const { result } = renderHook(() => useUnifiedSession());
    expect(result.current.modeTransitions).toEqual([]);
  });

  it("initial isSwitching is false", () => {
    const { result } = renderHook(() => useUnifiedSession());
    expect(result.current.isSwitching).toBe(false);
  });

  describe("switchMode", () => {
    it("switches from voice to text without mic check", async () => {
      const { result } = renderHook(() => useUnifiedSession());

      await act(async () => {
        await result.current.switchMode("text");
      });

      expect(result.current.mode).toBe("text");
      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });

    it("switches from text to voice with mic check", async () => {
      const { result } = renderHook(() =>
        useUnifiedSession({ defaultMode: "text" }),
      );

      await act(async () => {
        await result.current.switchMode("voice");
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(result.current.mode).toBe("voice");
    });

    it("switches from text to digital_human with mic check", async () => {
      const { result } = renderHook(() =>
        useUnifiedSession({ defaultMode: "text" }),
      );

      await act(async () => {
        await result.current.switchMode("digital_human");
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(result.current.mode).toBe("digital_human");
    });

    it("degrades to text when mic denied on voice switch", async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error("NotAllowedError"));
      const { toast } = await import("sonner");

      const { result } = renderHook(() =>
        useUnifiedSession({ defaultMode: "text" }),
      );

      await act(async () => {
        await result.current.switchMode("voice");
      });

      expect(result.current.mode).toBe("text");
      expect(toast.warning).toHaveBeenCalledWith("micDenied");
    });

    it("records transition on successful switch", async () => {
      const { result } = renderHook(() => useUnifiedSession());

      await act(async () => {
        await result.current.switchMode("text");
      });

      expect(result.current.modeTransitions).toHaveLength(1);
      expect(result.current.modeTransitions[0]).toMatchObject({
        from: "voice",
        to: "text",
        reason: "user_switch",
      });
    });

    it("records mic_denied transition on failure", async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error("denied"));

      const { result } = renderHook(() =>
        useUnifiedSession({ defaultMode: "text" }),
      );

      await act(async () => {
        await result.current.switchMode("voice");
      });

      expect(result.current.modeTransitions).toHaveLength(1);
      expect(result.current.modeTransitions[0]).toMatchObject({
        from: "text",
        to: "text",
        reason: "mic_denied",
      });
    });

    it("does nothing when switching to same mode", async () => {
      const { result } = renderHook(() => useUnifiedSession());

      await act(async () => {
        await result.current.switchMode("voice");
      });

      expect(result.current.modeTransitions).toHaveLength(0);
    });

    it("calls onModeChange callback on successful switch", async () => {
      const onModeChange = vi.fn();
      const { result } = renderHook(() =>
        useUnifiedSession({ onModeChange }),
      );

      await act(async () => {
        await result.current.switchMode("text");
      });

      expect(onModeChange).toHaveBeenCalledWith("voice", "text");
    });

    it("does not call onModeChange on mic denied", async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error("denied"));
      const onModeChange = vi.fn();

      const { result } = renderHook(() =>
        useUnifiedSession({ defaultMode: "text", onModeChange }),
      );

      await act(async () => {
        await result.current.switchMode("voice");
      });

      expect(onModeChange).not.toHaveBeenCalled();
    });

    it("prevents concurrent switches (debounce)", async () => {
      // Start from text so switching to voice requires async mic check
      let resolveGetUserMedia: (v: unknown) => void;
      mockGetUserMedia.mockImplementation(
        () => new Promise((r) => { resolveGetUserMedia = r; }),
      );

      const { result } = renderHook(() =>
        useUnifiedSession({ defaultMode: "text" }),
      );

      // Start first switch (will wait on getUserMedia)
      let p1: Promise<void>;
      act(() => {
        p1 = result.current.switchMode("voice");
      });

      // While first is in-flight, attempt second switch
      await act(async () => {
        await result.current.switchMode("digital_human");
      });

      // Resolve the first getUserMedia
      await act(async () => {
        resolveGetUserMedia!(mockStream);
        await p1!;
      });

      // Only the first switch should have completed
      expect(result.current.modeTransitions).toHaveLength(1);
      expect(result.current.mode).toBe("voice");
    });
  });

  describe("degradeToText", () => {
    it("switches to text mode with fallback reason", async () => {
      const { toast } = await import("sonner");
      const { result } = renderHook(() => useUnifiedSession());

      act(() => {
        result.current.degradeToText("Connection lost");
      });

      expect(result.current.mode).toBe("text");
      expect(toast.warning).toHaveBeenCalledWith("Connection lost");
    });

    it("records fallback transition", () => {
      const { result } = renderHook(() => useUnifiedSession());

      act(() => {
        result.current.degradeToText("Error");
      });

      expect(result.current.modeTransitions).toHaveLength(1);
      expect(result.current.modeTransitions[0]).toMatchObject({
        from: "voice",
        to: "text",
        reason: "fallback",
      });
    });
  });

  describe("setVoiceConnectionState", () => {
    it("updates voiceConnectionState", () => {
      const { result } = renderHook(() => useUnifiedSession());

      act(() => {
        result.current.setVoiceConnectionState("connecting");
      });

      expect(result.current.voiceConnectionState).toBe("connecting");
    });

    it("can transition through all states", () => {
      const { result } = renderHook(() => useUnifiedSession());

      const states = ["connecting", "connected", "error", "disconnecting", "idle"] as const;
      for (const state of states) {
        act(() => {
          result.current.setVoiceConnectionState(state);
        });
        expect(result.current.voiceConnectionState).toBe(state);
      }
    });
  });
});
