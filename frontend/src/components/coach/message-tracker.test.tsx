import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageTracker } from "./message-tracker";
import type { KeyMessageStatus } from "@/types/session";

describe("MessageTracker", () => {
  it("renders delivered messages with green text", () => {
    const messages: KeyMessageStatus[] = [
      { message: "Efficacy data", delivered: true, detected_at: "2024-01-01" },
    ];
    render(<MessageTracker messages={messages} />);
    const text = screen.getByText("Efficacy data");
    expect(text).toHaveClass("text-green-700");
  });

  it("renders undelivered messages with slate text", () => {
    const messages: KeyMessageStatus[] = [
      { message: "Safety profile", delivered: false, detected_at: null },
    ];
    render(<MessageTracker messages={messages} />);
    const text = screen.getByText("Safety profile");
    expect(text).toHaveClass("text-slate-500");
  });

  it("renders empty list without crashing", () => {
    const { container } = render(<MessageTracker messages={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders mixed delivered and undelivered messages", () => {
    const messages: KeyMessageStatus[] = [
      { message: "Message A", delivered: true, detected_at: "2024-01-01" },
      { message: "Message B", delivered: false, detected_at: null },
    ];
    render(<MessageTracker messages={messages} />);
    expect(screen.getByText("Message A")).toHaveClass("text-green-700");
    expect(screen.getByText("Message B")).toHaveClass("text-slate-500");
  });
});
