import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioEvidencePlayer } from "./audio-evidence-player";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AudioEvidencePlayer", () => {
  const defaultUrl = "https://blob.example.com/audio.webm";

  it("renders audio element with correct source", () => {
    render(<AudioEvidencePlayer audioUrl={defaultUrl} />);
    const audio = screen.getByTestId("audio-element");
    expect(audio).toBeInTheDocument();
    const source = audio.querySelector("source");
    expect(source).toHaveAttribute("src", defaultUrl);
    expect(source).toHaveAttribute("type", "audio/webm");
  });

  it("renders label when provided", () => {
    render(<AudioEvidencePlayer audioUrl={defaultUrl} label="Session Recording" />);
    expect(screen.getByText("Session Recording")).toBeInTheDocument();
  });

  it("does not render label when not provided", () => {
    const { container } = render(<AudioEvidencePlayer audioUrl={defaultUrl} />);
    const spans = container.querySelectorAll("span");
    // Only the Volume2 icon wrapper, no label span
    expect(spans.length).toBe(0);
  });

  it("renders with data-testid", () => {
    render(<AudioEvidencePlayer audioUrl={defaultUrl} />);
    expect(screen.getByTestId("audio-evidence-player")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<AudioEvidencePlayer audioUrl={defaultUrl} className="custom-class" />);
    const container = screen.getByTestId("audio-evidence-player");
    expect(container.className).toContain("custom-class");
  });

  it("shows fallback text for unsupported browsers", () => {
    render(<AudioEvidencePlayer audioUrl={defaultUrl} />);
    // The fallback text is inside the audio element
    expect(screen.getByText("voiceScore.audioNotSupported")).toBeInTheDocument();
  });

  it("has controls attribute on audio element", () => {
    render(<AudioEvidencePlayer audioUrl={defaultUrl} />);
    const audio = screen.getByTestId("audio-element");
    expect(audio).toHaveAttribute("controls");
  });
});
