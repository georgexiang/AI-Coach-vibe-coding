import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "./chat-input";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("ChatInput", () => {
  const defaultProps = {
    onSend: vi.fn(),
    inputMode: "text" as const,
    onMicClick: vi.fn(),
    recordingState: "idle" as const,
  };

  it("renders textarea and buttons", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByLabelText("ariaSendMessage")).toBeInTheDocument();
    expect(screen.getByLabelText("ariaStartRecording")).toBeInTheDocument();
  });

  it("calls onSend with trimmed text when send button is clicked", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Hello World");
    const sendButton = screen.getByLabelText("ariaSendMessage");
    await userEvent.click(sendButton);
    expect(onSend).toHaveBeenCalledWith("Hello World");
  });

  it("does not call onSend when message is empty", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const sendButton = screen.getByLabelText("ariaSendMessage");
    await userEvent.click(sendButton);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("clears textarea after sending", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Test");
    await userEvent.click(screen.getByLabelText("ariaSendMessage"));
    expect(textarea).toHaveValue("");
  });

  it("disables textarea when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
