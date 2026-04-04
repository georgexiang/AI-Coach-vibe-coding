import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModeStatusIndicator } from "./mode-status-indicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    role,
    ...rest
  }: {
    children: React.ReactNode;
    className?: string;
    role?: string;
    variant?: string;
    "aria-live"?: "off" | "assertive" | "polite";
  }) => (
    <span data-testid="badge" className={className} role={role} {...rest}>
      {children}
    </span>
  ),
}));

describe("ModeStatusIndicator", () => {
  it("shows green dot and connected status when mode matches initial", () => {
    const { container } = render(
      <ModeStatusIndicator
        currentMode="digital_human_realtime_model"
        initialMode="digital_human_realtime_model"
        connectionState="connected"
      />,
    );
    const dot = container.querySelector("span.rounded-full");
    expect(dot?.className).toContain("bg-green-500");
    expect(screen.getByTestId("badge").textContent).toContain(
      "modeStatus.connected",
    );
  });

  it("shows amber dot and degraded status when mode differs from initial", () => {
    const { container } = render(
      <ModeStatusIndicator
        currentMode="voice_realtime_model"
        initialMode="digital_human_realtime_model"
        connectionState="connected"
      />,
    );
    const dot = container.querySelector("span.rounded-full");
    expect(dot?.className).toContain("bg-amber-500");
    expect(screen.getByTestId("badge").textContent).toContain(
      "modeStatus.degraded",
    );
  });

  it("shows red dot and disconnected status when disconnected", () => {
    const { container } = render(
      <ModeStatusIndicator
        currentMode="digital_human_realtime_model"
        initialMode="digital_human_realtime_model"
        connectionState="disconnected"
      />,
    );
    const dot = container.querySelector("span.rounded-full");
    expect(dot?.className).toContain("bg-destructive");
    expect(screen.getByTestId("badge").textContent).toContain(
      "modeStatus.disconnected",
    );
  });

  it("shows red dot on error connection state", () => {
    const { container } = render(
      <ModeStatusIndicator
        currentMode="voice_realtime_model"
        initialMode="voice_realtime_model"
        connectionState="error"
      />,
    );
    const dot = container.querySelector("span.rounded-full");
    expect(dot?.className).toContain("bg-destructive");
  });

  it("renders mode badge text from i18n key", () => {
    render(
      <ModeStatusIndicator
        currentMode="voice_realtime_model"
        initialMode="voice_realtime_model"
        connectionState="connected"
      />,
    );
    expect(screen.getByTestId("badge").textContent).toContain(
      "modeBadge.voice_realtime_model",
    );
  });

  it("has role=status and aria-live=polite for accessibility", () => {
    render(
      <ModeStatusIndicator
        currentMode="digital_human_realtime_model"
        initialMode="digital_human_realtime_model"
        connectionState="connected"
      />,
    );
    const badge = screen.getByTestId("badge");
    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.getAttribute("aria-live")).toBe("polite");
  });

  it("applies custom className", () => {
    render(
      <ModeStatusIndicator
        currentMode="digital_human_realtime_model"
        initialMode="digital_human_realtime_model"
        connectionState="connected"
        className="my-custom-class"
      />,
    );
    expect(screen.getByTestId("badge").className).toContain("my-custom-class");
  });
});
