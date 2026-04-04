import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveformViz } from "./waveform-viz";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("WaveformViz", () => {
  let rafCallbacks: FrameRequestCallback[];
  let rafIdCounter: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafIdCounter = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return ++rafIdCounter;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to flush one rAF frame
  function flushOneFrame() {
    const cbs = [...rafCallbacks];
    rafCallbacks = [];
    for (const cb of cbs) {
      cb(performance.now());
    }
  }

  it("renders 5 bar elements", () => {
    render(<WaveformViz audioState="idle" analyserData={null} />);
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars).toHaveLength(5);
  });

  it("shows listening label when audioState is listening", () => {
    render(<WaveformViz audioState="listening" analyserData={null} />);
    expect(screen.getByText("listening")).toBeInTheDocument();
  });

  it("shows speaking label when audioState is speaking", () => {
    render(<WaveformViz audioState="speaking" analyserData={null} />);
    expect(screen.getByText("speaking")).toBeInTheDocument();
  });

  it("shows idle label when audioState is idle", () => {
    render(<WaveformViz audioState="idle" analyserData={null} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <WaveformViz audioState="idle" analyserData={null} className="my-custom" />,
    );
    expect(container.firstElementChild).toHaveClass("my-custom");
  });

  it("bars have primary color class when listening", () => {
    render(
      <WaveformViz audioState="listening" analyserData={new Uint8Array(128)} />,
    );
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars[0]).toHaveClass("bg-primary");
  });

  it("bars have green color class when speaking", () => {
    render(
      <WaveformViz audioState="speaking" analyserData={new Uint8Array(128)} />,
    );
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars[0]).toHaveClass("bg-voice-speaking");
  });

  // NEW TESTS for uncovered branches

  it("shows idle label when audioState is muted", () => {
    render(<WaveformViz audioState="muted" analyserData={null} />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("bars have muted-foreground class with opacity when audioState is muted", () => {
    render(
      <WaveformViz audioState="muted" analyserData={null} />,
    );
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars[0]).toHaveClass("bg-muted-foreground");
  });

  it("bars have primary class with opacity when audioState is idle", () => {
    render(
      <WaveformViz audioState="idle" analyserData={null} />,
    );
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars[0]).toHaveClass("bg-primary");
  });

  it("has role=img for accessibility", () => {
    render(<WaveformViz audioState="idle" analyserData={null} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("has correct aria-label based on audioState", () => {
    render(<WaveformViz audioState="listening" analyserData={null} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "listening");
  });

  it("calls requestAnimationFrame on mount", () => {
    render(<WaveformViz audioState="idle" analyserData={null} />);
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it("calls cancelAnimationFrame on unmount", () => {
    const { unmount } = render(<WaveformViz audioState="idle" analyserData={null} />);
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("updates bar scaleY using analyser data when listening", () => {
    const data = new Uint8Array(128);
    data[0] = 200; // High value for first bin
    render(<WaveformViz audioState="listening" analyserData={data} />);
    // Flush one frame to trigger updateBars
    flushOneFrame();
    const bars = screen.getAllByTestId("waveform-bar");
    // First bar's scaleY should be based on data[0] / 255 ~ 0.784
    const transform = bars[0]?.style.transform;
    expect(transform).toContain("scaleY(");
    expect(transform).not.toBe("scaleY(0.15)");
  });

  it("uses default height when analyserData is null even for listening", () => {
    render(<WaveformViz audioState="listening" analyserData={null} />);
    flushOneFrame();
    const bars = screen.getAllByTestId("waveform-bar");
    const transform = bars[0]?.style.transform;
    expect(transform).toContain("scaleY(0.15)");
  });

  it("uses default height when audioState is idle even with analyserData", () => {
    const data = new Uint8Array(128);
    data[0] = 200;
    render(<WaveformViz audioState="idle" analyserData={data} />);
    flushOneFrame();
    const bars = screen.getAllByTestId("waveform-bar");
    const transform = bars[0]?.style.transform;
    expect(transform).toContain("scaleY(0.15)");
  });

  it("handles unknown audioState gracefully in getBarColor (default branch)", () => {
    render(<WaveformViz audioState={"unknown" as never} analyserData={null} />);
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars[0]).toHaveClass("bg-muted-foreground");
  });

  it("renders label text below bars as p element", () => {
    render(<WaveformViz audioState="speaking" analyserData={null} />);
    const label = screen.getByText("speaking");
    expect(label.tagName.toLowerCase()).toBe("p");
  });

  it("bars receive varying frequency data when speaking with analyserData", () => {
    const data = new Uint8Array(128);
    for (let i = 0; i < 128; i++) {
      data[i] = i * 2;
    }
    render(<WaveformViz audioState="speaking" analyserData={data} />);
    flushOneFrame();
    const bars = screen.getAllByTestId("waveform-bar");
    expect(bars.length).toBe(5);
    // All bars should have been updated
    for (const bar of bars) {
      expect(bar.style.transform).toContain("scaleY(");
    }
  });

  it("aria-label shows speaking for speaking audioState", () => {
    render(<WaveformViz audioState="speaking" analyserData={null} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "speaking");
  });

  it("aria-label shows idle for muted audioState", () => {
    render(<WaveformViz audioState="muted" analyserData={null} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "idle");
  });
});
