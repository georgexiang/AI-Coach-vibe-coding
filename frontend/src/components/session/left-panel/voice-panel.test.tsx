import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoicePanel } from "./voice-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/voice/audio-orb", () => ({
  AudioOrb: ({ className }: { className?: string }) => (
    <div data-testid="audio-orb" className={className} />
  ),
}));

describe("VoicePanel", () => {
  it("renders AudioOrb visualization", () => {
    render(
      <VoicePanel
        mode="voice"
        voiceConnectionState="connected"
        audioState="idle"
      />,
    );

    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
  });

  it("shows connecting spinner when connecting", () => {
    render(
      <VoicePanel
        mode="voice"
        voiceConnectionState="connecting"
        audioState="idle"
      />,
    );

    expect(screen.getByText("session.voice.connecting")).toBeInTheDocument();
  });

  it("shows error message on connection error", () => {
    render(
      <VoicePanel
        mode="voice"
        voiceConnectionState="error"
        audioState="idle"
      />,
    );

    expect(
      screen.getByText("session.voice.connectionError"),
    ).toBeInTheDocument();
  });

  it("shows ready label when connected", () => {
    render(
      <VoicePanel
        mode="voice"
        voiceConnectionState="connected"
        audioState="idle"
      />,
    );

    expect(screen.getByText("session.voice.ready")).toBeInTheDocument();
  });

  it("shows idle label when disconnected", () => {
    render(
      <VoicePanel
        mode="voice"
        voiceConnectionState="disconnected"
        audioState="idle"
      />,
    );

    expect(screen.getByText("session.voice.idle")).toBeInTheDocument();
  });

  it("applies dark background styling", () => {
    const { container } = render(
      <VoicePanel
        mode="voice"
        voiceConnectionState="connected"
        audioState="idle"
      />,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("bg-slate-900");
  });
});
