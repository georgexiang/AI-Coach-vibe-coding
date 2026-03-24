import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HintsPanel } from "./hints-panel";
import type { CoachingHint, KeyMessageStatus } from "@/types/session";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

// Mock the MessageTracker subcomponent to simplify testing
vi.mock("./message-tracker", () => ({
  MessageTracker: ({ messages }: { messages: KeyMessageStatus[] }) => (
    <div data-testid="message-tracker">{messages.length} messages</div>
  ),
}));

const defaultStats = {
  duration: 125,
  wordCount: 350,
  messageCount: 12,
};

const defaultKeyMessages: KeyMessageStatus[] = [
  { message: "Key msg 1", delivered: true, detected_at: "2024-01-01" },
  { message: "Key msg 2", delivered: false, detected_at: null },
];

describe("HintsPanel", () => {
  it("renders collapsed state with expand button", () => {
    render(
      <HintsPanel
        hints={[]}
        keyMessagesStatus={defaultKeyMessages}
        sessionStats={defaultStats}
        isCollapsed={true}
        onToggle={vi.fn()}
      />,
    );

    // In collapsed state, the button has aria-expanded=false
    const btn = screen.getByRole("button", { name: "session.coachingPanel" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("renders expanded state with panel title and sections", () => {
    render(
      <HintsPanel
        hints={[]}
        keyMessagesStatus={defaultKeyMessages}
        sessionStats={defaultStats}
        isCollapsed={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("session.coachingPanel")).toBeInTheDocument();
    expect(screen.getByText("session.aiCoachHints")).toBeInTheDocument();
    expect(screen.getByText("session.messageTracker")).toBeInTheDocument();
    expect(screen.getByText("session.sessionStats")).toBeInTheDocument();
  });

  it("calls onToggle when toggle button is clicked in expanded state", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <HintsPanel
        hints={[]}
        keyMessagesStatus={defaultKeyMessages}
        sessionStats={defaultStats}
        isCollapsed={false}
        onToggle={onToggle}
      />,
    );

    const btn = screen.getByRole("button", { expanded: true });
    await user.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("displays session stats with formatted duration", () => {
    render(
      <HintsPanel
        hints={[]}
        keyMessagesStatus={defaultKeyMessages}
        sessionStats={defaultStats}
        isCollapsed={false}
        onToggle={vi.fn()}
      />,
    );

    // Duration 125 seconds = 02:05
    expect(screen.getByText("02:05")).toBeInTheDocument();
    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("displays hint content when hints are provided", () => {
    const hints: CoachingHint[] = [
      { content: "Try asking about their concerns" },
      { content: "Mention the clinical trial data" },
    ];

    render(
      <HintsPanel
        hints={hints}
        keyMessagesStatus={defaultKeyMessages}
        sessionStats={defaultStats}
        isCollapsed={false}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Try asking about their concerns"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mention the clinical trial data"),
    ).toBeInTheDocument();
  });
});
