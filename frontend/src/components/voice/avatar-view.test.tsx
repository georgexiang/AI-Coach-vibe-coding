import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarView } from "./avatar-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

vi.mock("./audio-orb", () => ({
  AudioOrb: ({ audioState }: { audioState: string }) => (
    <div data-testid="audio-orb" data-audio-state={audioState} />
  ),
}));

const defaultProps: React.ComponentProps<typeof AvatarView> = {
  videoContainerRef: { current: null },
  isAvatarConnected: false,
  audioState: "idle",
  analyserData: null,
  isConnecting: false,
  hcpName: "Dr. Smith",
  isFullScreen: false,
};

describe("AvatarView", () => {
  it("shows skeleton when connecting", () => {
    render(<AvatarView {...defaultProps} isConnecting={true} />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.getByText("connectingAvatar")).toBeInTheDocument();
  });

  it("shows video container when avatar connected", () => {
    render(
      <AvatarView {...defaultProps} isAvatarConnected={true} />,
    );
    expect(screen.getByTestId("avatar-video-container")).toBeInTheDocument();
  });

  it("shows audio orb fallback when not connected and not connecting", () => {
    render(<AvatarView {...defaultProps} />);
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
  });

  it("passes audioState to audio orb", () => {
    render(<AvatarView {...defaultProps} audioState="listening" />);
    expect(screen.getByTestId("audio-orb")).toHaveAttribute(
      "data-audio-state",
      "listening",
    );
  });

  it("shows hcpName overlay", () => {
    render(<AvatarView {...defaultProps} />);
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("hides hcpName when empty", () => {
    render(<AvatarView {...defaultProps} hcpName="" />);
    expect(screen.queryByText("Dr. Smith")).not.toBeInTheDocument();
  });

  it("has role region with aria-label", () => {
    render(<AvatarView {...defaultProps} />);
    expect(screen.getByRole("region")).toHaveAttribute("aria-label", "title");
  });
});
