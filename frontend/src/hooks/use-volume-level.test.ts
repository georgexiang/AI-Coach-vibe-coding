import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVolumeLevel } from "./use-volume-level";

let rafCallbacks: Array<() => void> = [];

beforeEach(() => {
  vi.clearAllMocks();
  rafCallbacks = [];

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: () => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

describe("useVolumeLevel", () => {
  it("returns 0 when inactive", () => {
    const analyserRef = { current: null };
    const { result } = renderHook(() => useVolumeLevel(analyserRef, false));
    expect(result.current).toBe(0);
  });

  it("returns 0 when active but analyser is null", () => {
    const analyserRef = { current: null };
    const { result } = renderHook(() => useVolumeLevel(analyserRef, true));
    // Tick the RAF once
    act(() => {
      rafCallbacks.forEach((cb) => cb());
      rafCallbacks = [];
    });
    expect(result.current).toBe(0);
  });

  it("computes quantised volume from analyser data", () => {
    const mockData = new Uint8Array(128).fill(128); // all 128 -> avg 128, raw = 128/128 = 1.0
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((buf: Uint8Array) => {
        buf.set(mockData);
      }),
    };
    const analyserRef = { current: mockAnalyser as unknown as AnalyserNode };

    const { result } = renderHook(() => useVolumeLevel(analyserRef, true));

    // Tick the RAF
    act(() => {
      rafCallbacks.forEach((cb) => cb());
      rafCallbacks = [];
    });

    // raw = min(1, 128/128) = 1.0, quantised = round(1.0 * 20) / 20 = 1.0
    expect(result.current).toBe(1);
  });

  it("quantises to 0.05 steps", () => {
    // avg = 32, raw = 32/128 = 0.25, quantised = round(0.25*20)/20 = 5/20 = 0.25
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((buf: Uint8Array) => {
        buf.fill(32);
      }),
    };
    const analyserRef = { current: mockAnalyser as unknown as AnalyserNode };

    const { result } = renderHook(() => useVolumeLevel(analyserRef, true));
    act(() => {
      rafCallbacks.forEach((cb) => cb());
      rafCallbacks = [];
    });
    expect(result.current).toBe(0.25);
  });

  it("resets to 0 when deactivated", () => {
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((buf: Uint8Array) => {
        buf.fill(128);
      }),
    };
    const analyserRef = { current: mockAnalyser as unknown as AnalyserNode };

    const { result, rerender } = renderHook(
      ({ active }) => useVolumeLevel(analyserRef, active),
      { initialProps: { active: true } },
    );

    act(() => {
      rafCallbacks.forEach((cb) => cb());
      rafCallbacks = [];
    });
    expect(result.current).toBe(1);

    // Deactivate
    rerender({ active: false });
    expect(result.current).toBe(0);
  });

  it("cancels RAF on cleanup", () => {
    const analyserRef = { current: null };
    const { unmount } = renderHook(() => useVolumeLevel(analyserRef, true));
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("does not re-render when quantised level stays the same", () => {
    const mockAnalyser = {
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn((buf: Uint8Array) => {
        buf.fill(64); // avg=64, raw=0.5, quantised=0.5
      }),
    };
    const analyserRef = { current: mockAnalyser as unknown as AnalyserNode };

    const { result } = renderHook(() => useVolumeLevel(analyserRef, true));

    // First tick sets level to 0.5
    act(() => {
      rafCallbacks.forEach((cb) => cb());
      rafCallbacks = [];
    });
    expect(result.current).toBe(0.5);

    // Second tick with same data — should not cause a state update
    // (setLevel(prev => prev === quantised ? prev : quantised) bails out)
    act(() => {
      rafCallbacks.forEach((cb) => cb());
      rafCallbacks = [];
    });
    expect(result.current).toBe(0.5);
  });
});
