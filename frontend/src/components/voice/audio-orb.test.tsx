import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioOrb } from "./audio-orb";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AudioOrb", () => {
  it("renders the orb container", () => {
    render(<AudioOrb audioState="idle" />);
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
  });

  it("renders the main sphere", () => {
    render(<AudioOrb audioState="idle" />);
    expect(screen.getByTestId("orb-sphere")).toBeInTheDocument();
  });

  it("has role=img for accessibility", () => {
    render(<AudioOrb audioState="idle" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("shows idle label when audioState is idle", () => {
    render(<AudioOrb audioState="idle" />);
    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("shows listening label when audioState is listening", () => {
    render(<AudioOrb audioState="listening" />);
    expect(screen.getByText("listening")).toBeInTheDocument();
  });

  it("shows speaking label when audioState is speaking", () => {
    render(<AudioOrb audioState="speaking" />);
    expect(screen.getByText("speaking")).toBeInTheDocument();
  });

  it("shows muted label when audioState is muted", () => {
    render(<AudioOrb audioState="muted" />);
    expect(screen.getByText("muted")).toBeInTheDocument();
  });

  it("has correct aria-label based on audioState", () => {
    render(<AudioOrb audioState="listening" />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "listening");
  });

  it("renders ripple rings when listening", () => {
    render(<AudioOrb audioState="listening" />);
    const ripples = screen.getAllByTestId("orb-ripple");
    expect(ripples.length).toBeGreaterThanOrEqual(1);
  });

  it("renders ripple rings when speaking", () => {
    render(<AudioOrb audioState="speaking" />);
    const ripples = screen.getAllByTestId("orb-ripple");
    expect(ripples.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render ripple rings when idle", () => {
    render(<AudioOrb audioState="idle" />);
    expect(screen.queryByTestId("orb-ripple")).not.toBeInTheDocument();
  });

  it("does not render ripple rings when muted", () => {
    render(<AudioOrb audioState="muted" />);
    expect(screen.queryByTestId("orb-ripple")).not.toBeInTheDocument();
  });

  it("applies purple gradient classes and pulse animation when listening", () => {
    render(<AudioOrb audioState="listening" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).toContain("from-voice-listening");
    expect(sphere.className).toContain("audio-orb-pulse");
  });

  it("applies green gradient classes and pulse animation when speaking", () => {
    render(<AudioOrb audioState="speaking" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).toContain("from-voice-speaking");
    expect(sphere.className).toContain("audio-orb-pulse");
  });

  it("does not apply pulse animation when idle", () => {
    render(<AudioOrb audioState="idle" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).not.toContain("audio-orb-pulse");
  });

  it("does not apply pulse animation when muted", () => {
    render(<AudioOrb audioState="muted" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).not.toContain("audio-orb-pulse");
  });

  it("applies muted gray gradient classes when muted", () => {
    render(<AudioOrb audioState="muted" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).toContain("from-voice-muted");
  });

  it("uses volume-reactive inline scale when listening", () => {
    render(<AudioOrb audioState="listening" volumeLevel={0.5} />);
    const sphere = screen.getByTestId("orb-sphere");
    // scale = 1 + 0.5 * 0.18 = 1.09
    expect(sphere.style.transform).toBe("scale(1.09)");
  });

  it("uses volume-reactive inline scale when speaking", () => {
    render(<AudioOrb audioState="speaking" volumeLevel={1} />);
    const sphere = screen.getByTestId("orb-sphere");
    // scale = 1 + 1 * 0.18 = 1.18
    expect(sphere.style.transform).toBe("scale(1.18)");
  });

  it("sphere has scale(1) when idle regardless of volume", () => {
    render(<AudioOrb audioState="idle" volumeLevel={0.8} />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.style.transform).toBe("scale(1)");
  });

  it("applies breathe animation class when idle", () => {
    render(<AudioOrb audioState="idle" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).toContain("audio-orb-breathe");
  });

  it("does not apply breathe animation when muted", () => {
    render(<AudioOrb audioState="muted" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.className).not.toContain("audio-orb-breathe");
  });

  it("sphere base size is 160px", () => {
    render(<AudioOrb audioState="idle" />);
    const sphere = screen.getByTestId("orb-sphere");
    expect(sphere.style.width).toBe("160px");
    expect(sphere.style.height).toBe("160px");
  });

  it("applies custom className when provided", () => {
    render(<AudioOrb audioState="idle" className="my-custom" />);
    expect(screen.getByTestId("audio-orb")).toHaveClass("my-custom");
  });

  it("label has purple color when listening", () => {
    render(<AudioOrb audioState="listening" />);
    const label = screen.getByText("listening");
    expect(label.className).toContain("text-voice-listening");
  });

  it("label has green color when speaking", () => {
    render(<AudioOrb audioState="speaking" />);
    const label = screen.getByText("speaking");
    expect(label.className).toContain("text-voice-speaking");
  });
});
