import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatBubble } from "./chat-bubble";

describe("ChatBubble", () => {
  it("renders message text", () => {
    render(
      <ChatBubble sender="hcp" text="Hello doctor" timestamp={new Date(2024, 0, 1, 14, 30)} />,
    );
    expect(screen.getByText("Hello doctor")).toBeInTheDocument();
  });

  it("formats and displays timestamp", () => {
    render(
      <ChatBubble sender="hcp" text="Test" timestamp={new Date(2024, 0, 1, 9, 5)} />,
    );
    expect(screen.getByText("09:05")).toBeInTheDocument();
  });

  it("aligns hcp messages to the left", () => {
    const { container } = render(
      <ChatBubble sender="hcp" text="HCP msg" timestamp={new Date()} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });

  it("aligns mr messages to the right", () => {
    const { container } = render(
      <ChatBubble sender="mr" text="MR msg" timestamp={new Date()} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });
});
