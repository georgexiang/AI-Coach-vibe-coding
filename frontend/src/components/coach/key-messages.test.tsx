import { render, screen } from "@testing-library/react";
import { KeyMessages } from "./key-messages";
import type { KeyMessageStatus } from "@/types/session";

describe("KeyMessages", () => {
  it("renders delivered messages with line-through styling", () => {
    const messages: KeyMessageStatus[] = [
      { message: "Efficacy data", delivered: true, detected_at: "2024-01-01" },
    ];

    render(<KeyMessages messages={messages} />);
    const text = screen.getByText("Efficacy data");
    expect(text).toHaveClass("line-through");
    expect(text).toHaveClass("text-green-700");
  });

  it("renders undelivered messages without line-through", () => {
    const messages: KeyMessageStatus[] = [
      { message: "Safety profile", delivered: false, detected_at: null },
    ];

    render(<KeyMessages messages={messages} />);
    const text = screen.getByText("Safety profile");
    expect(text).not.toHaveClass("line-through");
    expect(text).toHaveClass("text-slate-700");
  });

  it("renders empty list without crashing", () => {
    const { container } = render(<KeyMessages messages={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders mixed delivered and undelivered messages", () => {
    const messages: KeyMessageStatus[] = [
      { message: "Message A", delivered: true, detected_at: "2024-01-01" },
      { message: "Message B", delivered: false, detected_at: null },
      { message: "Message C", delivered: true, detected_at: "2024-01-02" },
    ];

    render(<KeyMessages messages={messages} />);

    expect(screen.getByText("Message A")).toHaveClass("line-through");
    expect(screen.getByText("Message B")).not.toHaveClass("line-through");
    expect(screen.getByText("Message C")).toHaveClass("line-through");
  });
});
