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

  // NEW TESTS for uncovered branches

  it("sends message on Enter key press (not Shift+Enter)", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Enter message");
    await userEvent.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("Enter message");
  });

  it("does not send message on Shift+Enter (allows newline)", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "Line 1");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables textarea when inputMode is audio", () => {
    render(<ChatInput {...defaultProps} inputMode="audio" />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("shows MicOff icon when recording state is recording", () => {
    render(
      <ChatInput {...defaultProps} recordingState="recording" />,
    );
    expect(screen.getByLabelText("ariaStopRecording")).toBeInTheDocument();
  });

  it("shows Mic icon when recording state is idle", () => {
    render(
      <ChatInput {...defaultProps} recordingState="idle" />,
    );
    expect(screen.getByLabelText("ariaStartRecording")).toBeInTheDocument();
  });

  it("calls onMicClick when mic button is clicked", async () => {
    const onMicClick = vi.fn();
    render(<ChatInput {...defaultProps} onMicClick={onMicClick} />);
    const micBtn = screen.getByLabelText("ariaStartRecording");
    await userEvent.click(micBtn);
    expect(onMicClick).toHaveBeenCalled();
  });

  it("send button is disabled when inputMode is audio even with text", async () => {
    render(<ChatInput {...defaultProps} inputMode="audio" />);
    const sendBtn = screen.getByLabelText("ariaSendMessage");
    expect(sendBtn).toBeDisabled();
  });

  it("renders text mode and audio mode toggle buttons", () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByText("textMode")).toBeInTheDocument();
    expect(screen.getByText("audioMode")).toBeInTheDocument();
  });

  it("text mode button has active style when inputMode is text", () => {
    render(<ChatInput {...defaultProps} inputMode="text" />);
    const textBtn = screen.getByText("textMode");
    expect(textBtn.className).toContain("bg-primary");
  });

  it("audio mode button has active style when inputMode is audio", () => {
    render(<ChatInput {...defaultProps} inputMode="audio" />);
    const audioBtn = screen.getByText("audioMode");
    expect(audioBtn.className).toContain("bg-primary");
  });

  it("clicking text mode button when in audio mode calls onMicClick", async () => {
    const onMicClick = vi.fn();
    render(<ChatInput {...defaultProps} inputMode="audio" onMicClick={onMicClick} />);
    const textBtn = screen.getByText("textMode");
    await userEvent.click(textBtn);
    expect(onMicClick).toHaveBeenCalled();
  });

  it("clicking audio mode button when in text mode calls onMicClick", async () => {
    const onMicClick = vi.fn();
    render(<ChatInput {...defaultProps} inputMode="text" onMicClick={onMicClick} />);
    const audioBtn = screen.getByText("audioMode");
    await userEvent.click(audioBtn);
    expect(onMicClick).toHaveBeenCalled();
  });

  it("clicking text mode button when already in text mode does not call onMicClick", async () => {
    const onMicClick = vi.fn();
    render(<ChatInput {...defaultProps} inputMode="text" onMicClick={onMicClick} />);
    const textBtn = screen.getByText("textMode");
    await userEvent.click(textBtn);
    expect(onMicClick).not.toHaveBeenCalled();
  });

  it("clicking audio mode button when already in audio mode does not call onMicClick", async () => {
    const onMicClick = vi.fn();
    render(<ChatInput {...defaultProps} inputMode="audio" onMicClick={onMicClick} />);
    const audioBtn = screen.getByText("audioMode");
    await userEvent.click(audioBtn);
    expect(onMicClick).not.toHaveBeenCalled();
  });

  it("does not send whitespace-only messages", async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "   ");
    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("mic button is disabled when disabled prop is true", () => {
    render(<ChatInput {...defaultProps} disabled />);
    const micBtn = screen.getByLabelText("ariaStartRecording");
    expect(micBtn).toBeDisabled();
  });

  it("recording state processing applies correct class to mic button", () => {
    render(
      <ChatInput {...defaultProps} recordingState="processing" />,
    );
    const micBtn = screen.getByLabelText("ariaStartRecording");
    expect(micBtn.className).toContain("text-weakness");
  });
});
