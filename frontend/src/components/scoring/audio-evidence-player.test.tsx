import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AudioEvidencePlayer } from "./audio-evidence-player";
import apiClient from "@/api/client";

vi.mock("@/api/client", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AudioEvidencePlayer", () => {
  const defaultUrl = "/sessions/session-1/audio";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:session-audio"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("renders audio element with fetched blob source", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: new Blob(["audio"]) });

    render(<AudioEvidencePlayer audioUrl={defaultUrl} />);
    const audio = screen.getByTestId("audio-element");
    expect(audio).toBeInTheDocument();
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(defaultUrl, {
        responseType: "blob",
      });
    });
    const source = await waitFor(() => audio.querySelector("source"));
    expect(source).toHaveAttribute("src", "blob:session-audio");
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
