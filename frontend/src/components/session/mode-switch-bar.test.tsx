import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeSwitchBar } from "./mode-switch-bar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ModeSwitchBar", () => {
  const defaultProps = {
    currentMode: "voice" as const,
    onSwitchMode: vi.fn(),
    isSwitching: false,
  };

  it("renders three mode buttons", () => {
    render(<ModeSwitchBar {...defaultProps} />);

    expect(screen.getByTestId("mode-btn-text")).toBeInTheDocument();
    expect(screen.getByTestId("mode-btn-voice")).toBeInTheDocument();
    expect(screen.getByTestId("mode-btn-digital_human")).toBeInTheDocument();
  });

  it("shows i18n labels for each mode", () => {
    render(<ModeSwitchBar {...defaultProps} />);

    expect(screen.getByText("mode.text")).toBeInTheDocument();
    expect(screen.getByText("mode.voice")).toBeInTheDocument();
    expect(screen.getByText("mode.digitalHuman")).toBeInTheDocument();
  });

  it("disables current mode button", () => {
    render(<ModeSwitchBar {...defaultProps} currentMode="voice" />);

    expect(screen.getByTestId("mode-btn-voice")).toBeDisabled();
  });

  it("calls onSwitchMode when clicking non-active button", () => {
    const onSwitchMode = vi.fn();
    render(<ModeSwitchBar {...defaultProps} onSwitchMode={onSwitchMode} />);

    fireEvent.click(screen.getByTestId("mode-btn-text"));
    expect(onSwitchMode).toHaveBeenCalledWith("text");
  });

  it("disables all buttons when isSwitching is true", () => {
    render(<ModeSwitchBar {...defaultProps} isSwitching={true} />);

    expect(screen.getByTestId("mode-btn-text")).toBeDisabled();
    expect(screen.getByTestId("mode-btn-voice")).toBeDisabled();
    expect(screen.getByTestId("mode-btn-digital_human")).toBeDisabled();
  });

  it("disables all buttons when disabled prop is true", () => {
    render(<ModeSwitchBar {...defaultProps} disabled={true} />);

    expect(screen.getByTestId("mode-btn-text")).toBeDisabled();
    expect(screen.getByTestId("mode-btn-digital_human")).toBeDisabled();
  });

  it("does not call onSwitchMode for current mode button", () => {
    const onSwitchMode = vi.fn();
    render(
      <ModeSwitchBar
        {...defaultProps}
        currentMode="text"
        onSwitchMode={onSwitchMode}
      />,
    );

    fireEvent.click(screen.getByTestId("mode-btn-text"));
    expect(onSwitchMode).not.toHaveBeenCalled();
  });
});
