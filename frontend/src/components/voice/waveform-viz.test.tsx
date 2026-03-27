import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveformViz } from "./waveform-viz";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("WaveformViz", () => {
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
    expect(bars[0]).toHaveClass("bg-[#22C55E]");
  });
});
