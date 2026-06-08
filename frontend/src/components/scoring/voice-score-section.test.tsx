import { beforeEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VoiceScoreSection } from "./voice-score-section";
import type { ScoreDimension } from "@/hooks/use-combined-score";
import apiClient from "@/api/client";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./audio-evidence-player", () => ({
  AudioEvidencePlayer: ({ audioUrl, label }: { audioUrl: string; label?: string }) => (
    <div data-testid="audio-evidence-player" data-url={audioUrl}>
      {label}
    </div>
  ),
}));

vi.mock("@/api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockDimensions: ScoreDimension[] = [
  { id: "d1", dimension: "clarity", score: 80, weight: 0.3, strengths: "", weaknesses: "", suggestions: "", category: "voice", created_at: "" },
  { id: "d2", dimension: "pace", score: 70, weight: 0.2, strengths: "", weaknesses: "", suggestions: "", category: "voice", created_at: "" },
  { id: "d3", dimension: "confidence", score: 90, weight: 0.3, strengths: "", weaknesses: "", suggestions: "", category: "voice", created_at: "" },
];

describe("VoiceScoreSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when voiceScoreStatus is 'none'", () => {
    const { container } = render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="none"
        audioUrl={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows processing state when status is 'pending'", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={0}
        voiceScoreStatus="pending"
        audioUrl={null}
      />,
    );
    expect(screen.getByText("voiceScore.processing")).toBeInTheDocument();
    expect(screen.getByTestId("voice-score-section")).toBeInTheDocument();
  });

  it("shows processing state when status is 'processing'", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={0}
        voiceScoreStatus="processing"
        audioUrl={null}
      />,
    );
    expect(screen.getByText("voiceScore.processing")).toBeInTheDocument();
  });

  it("shows failed state when status is 'failed'", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={0}
        voiceScoreStatus="failed"
        audioUrl={null}
      />,
    );
    expect(screen.getByText("voiceScore.failed")).toBeInTheDocument();
  });

  it("retries voice scoring with a path relative to apiClient baseURL", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("retry failed"));

    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={0}
        voiceScoreStatus="failed"
        audioUrl={null}
        sessionId="session-123"
      />,
    );

    fireEvent.click(screen.getByTestId("retry-voice-scoring"));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/sessions/session-123/voice-score/retry",
      );
    });
  });

  it("renders completed state with overall score", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl={null}
      />,
    );
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("/100")).toBeInTheDocument();
    expect(screen.getByText("voiceScore.title")).toBeInTheDocument();
  });

  it("renders dimension progress bars", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl={null}
      />,
    );
    expect(screen.getByTestId("voice-bar-clarity")).toBeInTheDocument();
    expect(screen.getByTestId("voice-bar-pace")).toBeInTheDocument();
    expect(screen.getByTestId("voice-bar-confidence")).toBeInTheDocument();
  });

  it("renders dimension scores", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl={null}
      />,
    );
    expect(screen.getByText("80/100")).toBeInTheDocument();
    expect(screen.getByText("70/100")).toBeInTheDocument();
    expect(screen.getByText("90/100")).toBeInTheDocument();
  });

  it("renders AudioEvidencePlayer when audioUrl is provided", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl="https://blob.example.com/audio.webm"
      />,
    );
    const player = screen.getByTestId("audio-evidence-player");
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute("data-url", "https://blob.example.com/audio.webm");
  });

  it("does not render AudioEvidencePlayer when audioUrl is null", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl={null}
      />,
    );
    expect(screen.queryByTestId("audio-evidence-player")).not.toBeInTheDocument();
  });

  it("shows dimension labels with i18n keys", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl={null}
      />,
    );
    expect(screen.getByText("voiceScore.dimensions.clarity")).toBeInTheDocument();
    expect(screen.getByText("voiceScore.dimensions.pace")).toBeInTheDocument();
    expect(screen.getByText("voiceScore.dimensions.confidence")).toBeInTheDocument();
  });

  it("sets correct width on progress bars", () => {
    render(
      <VoiceScoreSection
        dimensions={mockDimensions}
        overallVoiceScore={80}
        voiceScoreStatus="completed"
        audioUrl={null}
      />,
    );
    const clarityBar = screen.getByTestId("voice-bar-clarity");
    expect(clarityBar).toHaveStyle({ width: "80%" });
    const paceBar = screen.getByTestId("voice-bar-pace");
    expect(paceBar).toHaveStyle({ width: "70%" });
  });
});
