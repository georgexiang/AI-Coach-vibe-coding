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
  videoRef: { current: null },
  isAvatarConnected: false,
  audioState: "idle",
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

  it("shows video element when avatar connected", () => {
    render(
      <AvatarView {...defaultProps} isAvatarConnected={true} />,
    );
    const video = screen.getByTestId("avatar-video");
    expect(video).toBeInTheDocument();
    expect(video.tagName).toBe("VIDEO");
    // When connected, video should be visible (opacity-100)
    expect(video.className).toContain("opacity-100");
  });

  it("always renders the video element in DOM", () => {
    render(<AvatarView {...defaultProps} />);
    // Video element should always be in the DOM (pre-rendered for WebRTC)
    expect(screen.getByTestId("avatar-video")).toBeInTheDocument();
  });

  it("hides video element when not connected (opacity-0, not display:none)", () => {
    render(<AvatarView {...defaultProps} />);
    const video = screen.getByTestId("avatar-video");
    // Should use opacity-0 NOT hidden/display:none — to keep it in the render tree
    expect(video.className).toContain("opacity-0");
    expect(video.className).not.toContain("hidden");
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

  it("video element has autoPlay and playsInline attributes", () => {
    render(<AvatarView {...defaultProps} />);
    const video = screen.getByTestId("avatar-video") as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.playsInline).toBe(true);
  });

  it("does not show audio orb when avatar is connected", () => {
    render(<AvatarView {...defaultProps} isAvatarConnected={true} />);
    expect(screen.queryByTestId("audio-orb")).not.toBeInTheDocument();
  });

  it("does not show audio orb when connecting", () => {
    render(<AvatarView {...defaultProps} isConnecting={true} />);
    expect(screen.queryByTestId("audio-orb")).not.toBeInTheDocument();
  });
});
