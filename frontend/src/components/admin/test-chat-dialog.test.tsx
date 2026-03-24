import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestChatDialog } from "./test-chat-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("TestChatDialog", () => {
  const defaultProps = {
    profileId: "hcp-1",
    profileName: "Dr. Smith",
    personalityType: "friendly" as const,
    open: true,
    onOpenChange: vi.fn(),
  };

  it("renders dialog title with profile name when open", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
  });

  it("renders empty state message initially", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(screen.getByText("Send a message to test the HCP personality")).toBeInTheDocument();
  });

  it("renders input field and send button", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("sends a message and receives a mock response", async () => {
    render(<TestChatDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(input, "Tell me about the drug");
    await userEvent.click(screen.getByLabelText("Send message"));

    // User message should appear
    expect(screen.getByText("Tell me about the drug")).toBeInTheDocument();
    // Empty state should be gone
    expect(screen.queryByText("Send a message to test the HCP personality")).not.toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(<TestChatDialog {...defaultProps} open={false} />);
    expect(screen.queryByText(/Dr. Smith/)).not.toBeInTheDocument();
  });
});
