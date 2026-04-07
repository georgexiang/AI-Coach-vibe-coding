import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestChatDialog } from "./test-chat-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockTestChatWithAgent = vi.fn();

vi.mock("@/api/hcp-profiles", () => ({
  testChatWithAgent: (...args: unknown[]) => mockTestChatWithAgent(...args),
}));

describe("TestChatDialog", () => {
  const defaultProps = {
    profileId: "hcp-1",
    profileName: "Dr. Smith",
    personalityType: "friendly" as const,
    agentId: "agent-123",
    open: true,
    onOpenChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog title with profile name when open", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
  });

  it("renders agent description when agentId is provided", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(
      screen.getByText(/Real-time conversation with AI Foundry Agent/),
    ).toBeInTheDocument();
  });

  it("renders no-agent message when agentId is not provided", () => {
    render(<TestChatDialog {...defaultProps} agentId={undefined} />);
    expect(
      screen.getByText(/No agent synced/),
    ).toBeInTheDocument();
  });

  it("renders empty state message for agent-synced profile", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(
      screen.getByText("Send a message to chat with the AI Foundry Agent"),
    ).toBeInTheDocument();
  });

  it("renders empty state message for unsynced profile", () => {
    render(<TestChatDialog {...defaultProps} agentId={undefined} />);
    expect(
      screen.getByText("Agent sync required before chatting"),
    ).toBeInTheDocument();
  });

  it("renders input field and send button when agent is synced", () => {
    render(<TestChatDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("Type a message...")).toBeInTheDocument();
    expect(screen.getByLabelText("Send message")).toBeInTheDocument();
  });

  it("disables input when no agent is synced", () => {
    render(<TestChatDialog {...defaultProps} agentId={undefined} />);
    const input = screen.getByPlaceholderText("Agent not synced");
    expect(input).toBeDisabled();
  });

  it("sends a message and displays it", async () => {
    mockTestChatWithAgent.mockResolvedValue({
      response_text: "Hello, I am Dr. Smith.",
      response_id: "resp-1",
      agent_name: "Dr. Smith Agent",
      agent_version: "v1",
    });

    render(<TestChatDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(input, "Tell me about the drug");
    await userEvent.click(screen.getByLabelText("Send message"));

    // User message should appear
    expect(screen.getByText("Tell me about the drug")).toBeInTheDocument();

    // Wait for the API response
    await vi.waitFor(() => {
      expect(screen.getByText("Hello, I am Dr. Smith.")).toBeInTheDocument();
    });

    // Empty state should be gone
    expect(
      screen.queryByText("Send a message to chat with the AI Foundry Agent"),
    ).not.toBeInTheDocument();
  });

  it("displays error message when API call fails", async () => {
    mockTestChatWithAgent.mockRejectedValue(new Error("Network failure"));

    render(<TestChatDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(input, "Hello");
    await userEvent.click(screen.getByLabelText("Send message"));

    await vi.waitFor(() => {
      expect(screen.getByText("[Error] Network failure")).toBeInTheDocument();
    });
  });

  it("does not render dialog content when closed", () => {
    render(<TestChatDialog {...defaultProps} open={false} />);
    expect(screen.queryByText(/Dr. Smith/)).not.toBeInTheDocument();
  });

  it("does not send empty messages", async () => {
    render(<TestChatDialog {...defaultProps} />);
    // Click send without typing
    await userEvent.click(screen.getByLabelText("Send message"));
    expect(mockTestChatWithAgent).not.toHaveBeenCalled();
  });
});
