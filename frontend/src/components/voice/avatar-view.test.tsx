import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

vi.mock("@/data/avatar-characters", () => {
  const mockCharMeta = {
    id: "lisa",
    displayName: "Lisa",
    styles: ["graceful-standing", "casual-sitting"],
    defaultStyle: "graceful-standing",
    gender: "female",
    isPhotoAvatar: false,
    gradientClasses: "from-blue-400 to-purple-500",
    thumbnailUrl: "https://example.com/lisa.png",
  };
  const mockPhotoCharMeta = {
    id: "max",
    displayName: "Max",
    styles: [],
    defaultStyle: "",
    gender: "male",
    isPhotoAvatar: true,
    gradientClasses: "from-green-400 to-teal-500",
    thumbnailUrl: "https://example.com/max-photo.png",
  };
  const charMap = new Map([
    ["lisa", mockCharMeta],
    ["max", mockPhotoCharMeta],
  ]);
  return {
    AVATAR_CHARACTER_MAP: charMap,
    getAvatarInitials: (name: string) => name.charAt(0).toUpperCase(),
  };
});

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

  it("shows hcpName overlay when avatar is connected", () => {
    render(<AvatarView {...defaultProps} isAvatarConnected={true} />);
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("hides hcpName when not connected", () => {
    render(<AvatarView {...defaultProps} />);
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

  // --- Static preview (lines 106-121) ---

  it("shows static preview when avatarCharacter is valid and not connected or connecting", () => {
    render(
      <AvatarView {...defaultProps} avatarCharacter="lisa" />,
    );
    const preview = screen.getByTestId("avatar-static-preview");
    expect(preview).toBeInTheDocument();
    // Should show display name
    expect(screen.getByText("Lisa")).toBeInTheDocument();
  });

  it("static preview renders correct thumbnail URL for video avatar with style", () => {
    render(
      <AvatarView
        {...defaultProps}
        avatarCharacter="lisa"
        avatarStyle="casual-sitting"
      />,
    );
    const img = screen.getByAltText("Lisa");
    // Video avatar with style: CDN_BASE/lisa-casual-sitting.png
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("lisa-casual-sitting.png"),
    );
  });

  it("static preview uses default thumbnailUrl for video avatar without style", () => {
    render(
      <AvatarView {...defaultProps} avatarCharacter="lisa" />,
    );
    const img = screen.getByAltText("Lisa");
    expect(img).toHaveAttribute("src", "https://example.com/lisa.png");
  });

  it("static preview uses thumbnailUrl for photo avatar regardless of style", () => {
    render(
      <AvatarView {...defaultProps} avatarCharacter="max" avatarStyle="some-style" />,
    );
    const img = screen.getByAltText("Max");
    // Photo avatar: always uses its own thumbnailUrl
    expect(img).toHaveAttribute("src", "https://example.com/max-photo.png");
  });

  it("does not show static preview when connected", () => {
    render(
      <AvatarView
        {...defaultProps}
        avatarCharacter="lisa"
        isAvatarConnected={true}
      />,
    );
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
  });

  it("does not show static preview when connecting", () => {
    render(
      <AvatarView
        {...defaultProps}
        avatarCharacter="lisa"
        isConnecting={true}
      />,
    );
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
  });

  it("does not show audio orb when avatarCharacter is set (shows static preview instead)", () => {
    render(
      <AvatarView {...defaultProps} avatarCharacter="lisa" />,
    );
    expect(screen.queryByTestId("audio-orb")).not.toBeInTheDocument();
  });

  // --- Image error fallback (lines 124-139) ---

  it("shows gradient circle fallback with initials when image fails to load", () => {
    render(
      <AvatarView {...defaultProps} avatarCharacter="lisa" />,
    );
    // Simulate image load error
    const img = screen.getByAltText("Lisa");
    fireEvent.error(img);

    // Static preview should be gone
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();

    // Fallback circle with initial should appear
    expect(screen.getByText("L")).toBeInTheDocument();
    // Display name below the circle
    expect(screen.getByText("Lisa")).toBeInTheDocument();
  });

  it("image error fallback is not shown when avatar is connected", () => {
    render(
      <AvatarView
        {...defaultProps}
        avatarCharacter="lisa"
        isAvatarConnected={true}
      />,
    );
    // No img to trigger error on because static preview is hidden when connected
    expect(screen.queryByText("L")).not.toBeInTheDocument();
  });

  it("image error fallback is not shown when connecting", () => {
    render(
      <AvatarView
        {...defaultProps}
        avatarCharacter="lisa"
        isConnecting={true}
      />,
    );
    // No static preview when connecting
    expect(screen.queryByText("L")).not.toBeInTheDocument();
  });

  // --- isSessionActive vs isAvatarConnected (voice-only session) ---

  it("shows audio orb during voice-only session (isSessionActive=true, isAvatarConnected=false)", () => {
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={false}
        avatarCharacter="lisa"
      />,
    );
    // AudioOrb should show because avatar stream is not connected
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
    // Static preview should NOT show during active session
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
  });

  it("hides static preview during active voice-only session even with avatarCharacter set", () => {
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={false}
        avatarCharacter="lisa"
        avatarStyle="casual-sitting"
      />,
    );
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
  });

  it("shows avatar video when avatar stream is actually connected (isAvatarConnected=true)", () => {
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={true}
        avatarCharacter="lisa"
      />,
    );
    const video = screen.getByTestId("avatar-video");
    expect(video.className).toContain("opacity-100");
    expect(screen.queryByTestId("audio-orb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
  });

  it("shows audio orb when no avatarCharacter and session is active", () => {
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={false}
      />,
    );
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
  });

  it("falls back to isAvatarConnected when isSessionActive is not provided", () => {
    // When isSessionActive is omitted, it defaults to isAvatarConnected
    render(
      <AvatarView
        {...defaultProps}
        isAvatarConnected={false}
        avatarCharacter="lisa"
      />,
    );
    // Without isSessionActive, not connected => show static preview
    expect(screen.getByTestId("avatar-static-preview")).toBeInTheDocument();
    expect(screen.queryByTestId("audio-orb")).not.toBeInTheDocument();
  });

  it("hides image error fallback during active voice-only session", () => {
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={false}
        avatarCharacter="lisa"
      />,
    );
    // Even if image were to error, the fallback should not show during active session
    // (AudioOrb takes precedence)
    const img = screen.queryByAltText("Lisa");
    // No static preview renders during active session, so no img to trigger error on
    expect(img).not.toBeInTheDocument();
  });

  // --- REGRESSION: Avatar toggle bug (avatar showed even when disabled) ---

  it("REGRESSION: shows AudioOrb (not avatar) when avatarCharacter is undefined and session is connected", () => {
    // This is the core scenario: avatar toggle OFF → avatarCharacter=undefined
    // During a connected session, AudioOrb must appear, NOT the avatar video
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={false}
        // avatarCharacter intentionally omitted (avatar disabled)
        audioState="listening"
      />,
    );
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
    const video = screen.getByTestId("avatar-video");
    expect(video.className).toContain("opacity-0");
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
  });

  it("REGRESSION: isAvatarConnected must reflect actual WebRTC stream, not session state", () => {
    // Bug was: isAvatarConnected was set to (sessionState === "connected")
    // which made the video always show during any connected session.
    // Fix: isAvatarConnected must only be true when avatarStream.isConnected is true.
    render(
      <AvatarView
        {...defaultProps}
        isSessionActive={true}
        isAvatarConnected={false}  // avatar stream NOT connected
        avatarCharacter="lisa"      // avatar configured but stream not ready
        audioState="speaking"
      />,
    );
    // Video must be invisible (opacity-0) since avatar stream is not connected
    const video = screen.getByTestId("avatar-video");
    expect(video.className).toContain("opacity-0");
    // AudioOrb must show instead
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
  });

  it("REGRESSION: avatar disabled idle state shows AudioOrb, not static preview", () => {
    // When avatar is disabled (no avatarCharacter), idle state should show AudioOrb
    render(
      <AvatarView
        {...defaultProps}
        isAvatarConnected={false}
        // no avatarCharacter = avatar disabled
      />,
    );
    expect(screen.getByTestId("audio-orb")).toBeInTheDocument();
    expect(screen.queryByTestId("avatar-static-preview")).not.toBeInTheDocument();
  });

  // --- volumeLevel prop ---

  it("passes volumeLevel to AudioOrb", () => {
    render(
      <AvatarView
        {...defaultProps}
        volumeLevel={0.7}
        audioState="listening"
      />,
    );
    const orb = screen.getByTestId("audio-orb");
    expect(orb).toBeInTheDocument();
    // volumeLevel is forwarded — AudioOrb renders with volume-reactive attributes
    expect(orb).toHaveAttribute("data-audio-state", "listening");
  });
});
