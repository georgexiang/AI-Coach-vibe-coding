import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { GuidanceCards } from "./guidance-cards";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

import { afterEach } from "vitest";

describe("GuidanceCards", () => {
  const baseProps = {
    mode: "voice" as const,
    isConnected: true,
    modeTransitions: [],
    sessionId: "test-session-1",
  };

  it("renders start-talking card when voice mode and connected", () => {
    render(<GuidanceCards {...baseProps} />);

    expect(
      screen.getByTestId("guidance-card-start-talking"),
    ).toBeInTheDocument();
  });

  it("renders switch-modes card when no transitions yet", () => {
    render(<GuidanceCards {...baseProps} />);

    expect(
      screen.getByTestId("guidance-card-switch-modes"),
    ).toBeInTheDocument();
  });

  it("does not render switch-modes card after transitions", () => {
    render(
      <GuidanceCards
        {...baseProps}
        modeTransitions={[
          { from: "voice", to: "text", timestamp: Date.now(), reason: "user_switch" },
        ]}
      />,
    );

    expect(
      screen.queryByTestId("guidance-card-switch-modes"),
    ).not.toBeInTheDocument();
  });

  it("dismisses card on X button click", () => {
    render(<GuidanceCards {...baseProps} />);

    const card = screen.getByTestId("guidance-card-start-talking");
    const dismissBtn = card.querySelector("button");
    fireEvent.click(dismissBtn!);

    expect(
      screen.queryByTestId("guidance-card-start-talking"),
    ).not.toBeInTheDocument();
  });

  it("persists dismissed state in localStorage", () => {
    render(<GuidanceCards {...baseProps} />);

    const card = screen.getByTestId("guidance-card-start-talking");
    const dismissBtn = card.querySelector("button");
    fireEvent.click(dismissBtn!);

    const stored = localStorage.getItem("guidance-dismissed-test-session-1");
    expect(stored).toContain("start-talking");
  });

  it("reads dismissed state from localStorage on mount", () => {
    localStorage.setItem(
      "guidance-dismissed-test-session-1",
      JSON.stringify(["start-talking", "switch-modes"]),
    );

    render(<GuidanceCards {...baseProps} />);

    expect(
      screen.queryByTestId("guidance-card-start-talking"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("guidance-card-switch-modes"),
    ).not.toBeInTheDocument();
  });

  it("auto-dismisses cards after 10 seconds", () => {
    render(<GuidanceCards {...baseProps} />);

    expect(
      screen.getByTestId("guidance-card-start-talking"),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10001);
    });

    expect(
      screen.queryByTestId("guidance-card-start-talking"),
    ).not.toBeInTheDocument();
  });

  it("does not render cards when not connected in voice mode", () => {
    render(<GuidanceCards {...baseProps} isConnected={false} />);

    expect(
      screen.queryByTestId("guidance-card-start-talking"),
    ).not.toBeInTheDocument();
  });

  it("renders end-session card after 2+ transitions", () => {
    render(
      <GuidanceCards
        {...baseProps}
        isConnected={false}
        modeTransitions={[
          { from: "voice", to: "text", timestamp: Date.now(), reason: "user_switch" },
          { from: "text", to: "voice", timestamp: Date.now(), reason: "user_switch" },
        ]}
      />,
    );

    expect(
      screen.getByTestId("guidance-card-end-session"),
    ).toBeInTheDocument();
  });

  it("uses session.guidance i18n keys", () => {
    render(<GuidanceCards {...baseProps} />);

    expect(
      screen.getByText("session.guidance.startTalking"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("session.guidance.switchModes"),
    ).toBeInTheDocument();
  });
});
