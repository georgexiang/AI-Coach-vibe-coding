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

  // NEW TESTS for uncovered branches

  it("renders speaker name when speakerName is provided", () => {
    render(
      <ChatBubble
        sender="hcp"
        text="Hello"
        timestamp={new Date()}
        speakerName="Dr. Smith"
      />,
    );
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("does not render speaker name paragraph when speakerName is not provided", () => {
    const { container } = render(
      <ChatBubble sender="hcp" text="Hello" timestamp={new Date()} />,
    );
    // There should be no speaker name element (only the message text and timestamp)
    const paragraphs = container.querySelectorAll("p");
    // 2 paragraphs: message text + timestamp
    expect(paragraphs.length).toBe(2);
  });

  it("applies speakerColor as inline style when both speakerName and speakerColor are provided", () => {
    render(
      <ChatBubble
        sender="hcp"
        text="Hello"
        timestamp={new Date()}
        speakerName="Dr. Smith"
        speakerColor="#FF0000"
      />,
    );
    const nameEl = screen.getByText("Dr. Smith");
    expect(nameEl).toHaveStyle({ color: "#FF0000" });
  });

  it("does not apply inline style when speakerName is provided but speakerColor is not", () => {
    render(
      <ChatBubble
        sender="hcp"
        text="Hello"
        timestamp={new Date()}
        speakerName="Dr. Smith"
      />,
    );
    const nameEl = screen.getByText("Dr. Smith");
    expect(nameEl).not.toHaveAttribute("style");
  });

  it("mr timestamp has text-right class", () => {
    render(
      <ChatBubble sender="mr" text="MR msg" timestamp={new Date(2024, 0, 1, 14, 30)} />,
    );
    const timestamp = screen.getByText("14:30");
    expect(timestamp.className).toContain("text-right");
  });

  it("hcp timestamp does not have text-right class", () => {
    render(
      <ChatBubble sender="hcp" text="HCP msg" timestamp={new Date(2024, 0, 1, 14, 30)} />,
    );
    const timestamp = screen.getByText("14:30");
    expect(timestamp.className).not.toContain("text-right");
  });

  it("applies correct bubble style for hcp sender", () => {
    const { container } = render(
      <ChatBubble sender="hcp" text="HCP msg" timestamp={new Date()} />,
    );
    const bubble = container.querySelector(".rounded-2xl");
    expect(bubble?.className).toContain("rounded-tl-sm");
    expect(bubble?.className).toContain("bg-primary");
  });

  it("applies correct bubble style for mr sender", () => {
    const { container } = render(
      <ChatBubble sender="mr" text="MR msg" timestamp={new Date()} />,
    );
    const bubble = container.querySelector(".rounded-2xl");
    expect(bubble?.className).toContain("rounded-tr-sm");
    expect(bubble?.className).toContain("bg-muted");
  });

  it("formats midnight timestamp correctly", () => {
    render(
      <ChatBubble sender="hcp" text="Midnight" timestamp={new Date(2024, 0, 1, 0, 0)} />,
    );
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });
});
