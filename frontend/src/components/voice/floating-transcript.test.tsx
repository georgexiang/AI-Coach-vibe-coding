import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingTranscript } from "./floating-transcript";
import type { TranscriptSegment } from "@/types/voice-live";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) =>
      opts?.name ? `${key}:${opts.name}` : key,
  }),
}));

describe("FloatingTranscript", () => {
  it("returns null when lastTranscript is null", () => {
    const { container } = render(
      <FloatingTranscript lastTranscript={null} hcpName="Dr. Chen" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows user speaker label for user role", () => {
    const segment: TranscriptSegment = {
      id: "user-1",
      role: "user",
      content: "Hello doctor",
      isFinal: true,
      timestamp: Date.now(),
    };
    render(<FloatingTranscript lastTranscript={segment} hcpName="Dr. Chen" />);
    expect(screen.getByText("transcript.user")).toBeInTheDocument();
    expect(screen.getByText("Hello doctor")).toBeInTheDocument();
  });

  it("shows HCP speaker label for assistant role with hcpName", () => {
    const segment: TranscriptSegment = {
      id: "assistant-1",
      role: "assistant",
      content: "Good morning",
      isFinal: true,
      timestamp: Date.now(),
    };
    render(<FloatingTranscript lastTranscript={segment} hcpName="Dr. Chen" />);
    expect(screen.getByText("transcript.hcp:Dr. Chen")).toBeInTheDocument();
    expect(screen.getByText("Good morning")).toBeInTheDocument();
  });

  it("applies text-primary class for user messages", () => {
    const segment: TranscriptSegment = {
      id: "user-2",
      role: "user",
      content: "Question",
      isFinal: true,
      timestamp: Date.now(),
    };
    render(<FloatingTranscript lastTranscript={segment} hcpName="Dr. Chen" />);
    const label = screen.getByText("transcript.user");
    expect(label.className).toContain("text-primary");
  });

  it("applies green color for assistant messages", () => {
    const segment: TranscriptSegment = {
      id: "assistant-2",
      role: "assistant",
      content: "Response",
      isFinal: true,
      timestamp: Date.now(),
    };
    render(<FloatingTranscript lastTranscript={segment} hcpName="Dr. Chen" />);
    const label = screen.getByText("transcript.hcp:Dr. Chen");
    expect(label.className).toContain("text-voice-speaking");
  });
});
