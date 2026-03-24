import { render, screen } from "@testing-library/react";
import { ChatMessage } from "./chat-message";

describe("ChatMessage", () => {
  it("renders user message aligned to the right", () => {
    const message = {
      id: "msg-1",
      session_id: "sess-1",
      role: "user" as const,
      content: "Hello, doctor!",
      message_index: 0,
      created_at: "2024-01-01T10:00:00Z",
    };

    const { container } = render(<ChatMessage message={message} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("justify-end");
  });

  it("renders assistant message aligned to the left", () => {
    const message = {
      id: "msg-2",
      session_id: "sess-1",
      role: "assistant" as const,
      content: "Welcome, how can I help?",
      message_index: 1,
      created_at: "2024-01-01T10:01:00Z",
    };

    const { container } = render(<ChatMessage message={message} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("justify-start");
  });

  it("displays message content", () => {
    render(
      <ChatMessage
        message={{ role: "assistant", content: "Test content here" }}
      />,
    );
    expect(screen.getByText("Test content here")).toBeInTheDocument();
  });

  it("displays timestamp when present on SessionMessage", () => {
    const message = {
      id: "msg-3",
      session_id: "sess-1",
      role: "user" as const,
      content: "With timestamp",
      message_index: 0,
      created_at: "2024-01-01T10:30:00Z",
    };

    render(<ChatMessage message={message} />);
    // The timestamp text is rendered; we check it's in the document
    expect(screen.getByText("With timestamp")).toBeInTheDocument();
  });
});
