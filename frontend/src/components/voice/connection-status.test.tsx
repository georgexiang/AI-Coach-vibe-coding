import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "./connection-status";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ConnectionStatus", () => {
  it("renders green dot and status.connected text for connected state", () => {
    const { container } = render(<ConnectionStatus state="connected" />);
    expect(screen.getByText("status.connected")).toBeInTheDocument();
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-voice-speaking");
  });

  it("renders orange dot and status.connecting text for connecting state", () => {
    const { container } = render(<ConnectionStatus state="connecting" />);
    expect(screen.getByText("status.connecting")).toBeInTheDocument();
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-voice-warning");
  });

  it("renders red dot and status.disconnected text for disconnected state", () => {
    const { container } = render(<ConnectionStatus state="disconnected" />);
    expect(screen.getByText("status.disconnected")).toBeInTheDocument();
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-destructive");
  });

  it("renders red dot and status.error text for error state", () => {
    const { container } = render(<ConnectionStatus state="error" />);
    expect(screen.getByText("status.error")).toBeInTheDocument();
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-destructive");
  });

  it("renders orange dot and status.reconnecting text for reconnecting state", () => {
    const { container } = render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText("status.reconnecting")).toBeInTheDocument();
    const dot = container.querySelector('[data-testid="status-dot"]');
    expect(dot).toHaveClass("bg-voice-warning");
  });

  it("has aria-live assertive attribute on the container", () => {
    render(<ConnectionStatus state="connected" />);
    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-live", "assertive");
  });

  it("applies custom className when provided", () => {
    render(<ConnectionStatus state="connected" className="custom-class" />);
    const container = screen.getByRole("status");
    expect(container).toHaveClass("custom-class");
  });
});
