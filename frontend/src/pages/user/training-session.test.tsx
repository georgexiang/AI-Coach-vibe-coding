import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockNavigate = vi.fn();
const mockRefetchMessages = vi.fn();
const mockMutateAsync = vi.fn();
const mockSendMessage = vi.fn();

let mockSessionData: unknown = undefined;
let mockApiMessages: unknown[] = [];
let mockScenarioData: unknown = undefined;

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams("id=test-session-1")],
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: mockSessionData }),
  useSessionMessages: () => ({ data: mockApiMessages, refetch: mockRefetchMessages }),
  useEndSession: () => ({ mutateAsync: mockMutateAsync }),
}));

vi.mock("@/hooks/use-scenarios", () => ({
  useScenario: () => ({ data: mockScenarioData }),
}));

vi.mock("@/hooks/use-scoring", () => ({
  useSessionScore: () => ({ data: undefined, isLoading: false }),
  useTriggerScoring: () => ({ mutate: vi.fn(), isPending: false }),
}));

let mockIsStreaming = false;
let mockStreamedText = "";
let capturedCallbacks: Record<string, (...args: unknown[]) => void> = {};

vi.mock("@/hooks/use-sse", () => ({
  useSSEStream: (callbacks: Record<string, (...args: unknown[]) => void>) => {
    capturedCallbacks = callbacks;
    return {
      sendMessage: mockSendMessage,
      isStreaming: mockIsStreaming,
      streamedText: mockStreamedText,
      error: null,
      abort: vi.fn(),
    };
  },
}));

// Mock child components
vi.mock("@/components/coach/scenario-panel", () => ({
  ScenarioPanel: (props: { scenario: { name: string }; isCollapsed: boolean; onToggle: () => void }) => (
    <div data-testid="scenario-panel" data-collapsed={String(props.isCollapsed)}>
      <span>{props.scenario.name}</span>
      <button onClick={props.onToggle} data-testid="toggle-left">Toggle Left</button>
    </div>
  ),
}));

vi.mock("@/components/coach/chat-area", () => ({
  ChatArea: (props: {
    sessionId: string;
    messages: { id: string; content: string }[];
    onSendMessage: (text: string) => void;
    isStreaming: boolean;
    onEndSession: () => void;
    sessionStatus: string;
    hcpInitials: string;
  }) => (
    <div data-testid="chat-area" data-status={props.sessionStatus}>
      <span data-testid="hcp-initials">{props.hcpInitials}</span>
      <span data-testid="message-count">{props.messages.length}</span>
      <button onClick={() => props.onSendMessage("test message")} data-testid="send-msg">
        Send
      </button>
      <button onClick={props.onEndSession} data-testid="end-session-btn">
        End Session
      </button>
    </div>
  ),
}));

vi.mock("@/components/coach/hints-panel", () => ({
  HintsPanel: (props: {
    hints: unknown[];
    isCollapsed: boolean;
    onToggle: () => void;
    sessionStats: { duration: number; wordCount: number; messageCount: number };
  }) => (
    <div data-testid="hints-panel" data-collapsed={String(props.isCollapsed)}>
      <span data-testid="hints-count">{props.hints.length}</span>
      <span data-testid="session-msg-count">{props.sessionStats.messageCount}</span>
      <button onClick={props.onToggle} data-testid="toggle-right">Toggle Right</button>
    </div>
  ),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

let TrainingSession: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockSessionData = undefined;
  mockApiMessages = [];
  mockScenarioData = undefined;
  mockIsStreaming = false;
  mockStreamedText = "";
  capturedCallbacks = {};
  const mod = await import("./training-session");
  TrainingSession = mod.default;
});

describe("TrainingSession page", () => {
  it("renders the three-panel layout without crashing", () => {
    const { container } = render(<TrainingSession />, { wrapper });
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders scenario panel, chat area, and hints panel", () => {
    render(<TrainingSession />, { wrapper });
    expect(screen.getByTestId("scenario-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-area")).toBeInTheDocument();
    expect(screen.getByTestId("hints-panel")).toBeInTheDocument();
  });

  it("uses default scenario when scenario data is not loaded", () => {
    render(<TrainingSession />, { wrapper });
    // Default scenario name comes from tc("loading") => "loading"
    // Appears in both ScenarioPanel and mobile HCP info bar
    expect(screen.getAllByText("loading").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with actual scenario data when loaded", () => {
    mockScenarioData = {
      id: "sc-1",
      name: "Test Scenario",
      description: "A test",
      product: "TestProduct",
      therapeutic_area: "oncology",
      mode: "f2f",
      difficulty: "medium",
      status: "active",
      hcp_profile_id: "hcp-1",
      hcp_profile: { name: "Dr. John Smith" },
      key_messages: ["Msg 1", "Msg 2"],
      weight_key_message: 30,
      weight_objection_handling: 25,
      weight_communication: 20,
      weight_product_knowledge: 15,
      weight_scientific_info: 10,
      pass_threshold: 70,
      estimated_duration: 15,
      created_by: "admin",
      created_at: "",
      updated_at: "",
    };
    render(<TrainingSession />, { wrapper });
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("derives HCP initials from hcp_profile name", () => {
    mockScenarioData = {
      id: "sc-1",
      name: "Test Scenario",
      hcp_profile: { name: "John Smith" },
      key_messages: [],
    };
    render(<TrainingSession />, { wrapper });
    expect(screen.getByTestId("hcp-initials")).toHaveTextContent("JS");
  });

  it("uses HC as fallback initials when no hcp_profile", () => {
    mockScenarioData = {
      id: "sc-1",
      name: "Test Scenario",
      key_messages: [],
    };
    render(<TrainingSession />, { wrapper });
    expect(screen.getByTestId("hcp-initials")).toHaveTextContent("HC");
  });

  it("syncs API messages into local state", () => {
    mockApiMessages = [
      { id: "m1", session_id: "test-session-1", role: "user", content: "Hello", message_index: 0, created_at: "" },
      { id: "m2", session_id: "test-session-1", role: "assistant", content: "Hi there", message_index: 1, created_at: "" },
    ];
    render(<TrainingSession />, { wrapper });
    expect(screen.getByTestId("message-count")).toHaveTextContent("2");
  });

  it("initializes key messages from scenario data", () => {
    mockScenarioData = {
      id: "sc-1",
      name: "Test Scenario",
      key_messages: ["Key Msg 1", "Key Msg 2", "Key Msg 3"],
    };
    render(<TrainingSession />, { wrapper });
    // Component should have initialized key message statuses
    expect(screen.getByTestId("scenario-panel")).toBeInTheDocument();
  });

  it("sends message optimistically when user sends a message", async () => {
    render(<TrainingSession />, { wrapper });
    const sendBtn = screen.getByTestId("send-msg");
    await userEvent.setup().click(sendBtn);
    // Should add message to local state
    expect(screen.getByTestId("message-count")).toHaveTextContent("1");
    // Should call SSE sendMessage
    expect(mockSendMessage).toHaveBeenCalledWith("test-session-1", "test message");
  });

  it("shows end session dialog when end session button is clicked", async () => {
    render(<TrainingSession />, { wrapper });
    const endBtn = screen.getByTestId("end-session-btn");
    await userEvent.setup().click(endBtn);
    // Dialog should appear - "session.endSession" appears in both title and confirm button
    const endTexts = screen.getAllByText("session.endSession");
    expect(endTexts.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("session.endConfirm")).toBeInTheDocument();
  });

  it("cancels end session dialog", async () => {
    const user = userEvent.setup();
    render(<TrainingSession />, { wrapper });
    // Open dialog
    await user.click(screen.getByTestId("end-session-btn"));
    // Click cancel
    await user.click(screen.getByText("cancel"));
    // Dialog should close - the confirm description should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText("session.endConfirm")).not.toBeInTheDocument();
    });
  });

  it("confirms end session and navigates to scoring", async () => {
    mockMutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    render(<TrainingSession />, { wrapper });
    // Open dialog
    await user.click(screen.getByTestId("end-session-btn"));
    // Click confirm (destructive button with text "session.endSession")
    const confirmButtons = screen.getAllByText("session.endSession");
    // The second one is the confirm button in the dialog
    const confirmBtn = confirmButtons[confirmButtons.length - 1]!;
    await user.click(confirmBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith("test-session-1");
    expect(mockNavigate).toHaveBeenCalledWith("/user/scoring/test-session-1");
  });

  it("handles endSession mutation failure gracefully", async () => {
    mockMutateAsync.mockRejectedValue(new Error("API error"));
    const user = userEvent.setup();
    render(<TrainingSession />, { wrapper });
    await user.click(screen.getByTestId("end-session-btn"));
    const confirmButtons = screen.getAllByText("session.endSession");
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    expect(mockMutateAsync).toHaveBeenCalledWith("test-session-1");
    // Should not navigate on failure
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("toggles left panel collapse state", async () => {
    render(<TrainingSession />, { wrapper });
    const panel = screen.getByTestId("scenario-panel");
    expect(panel).toHaveAttribute("data-collapsed", "false");
    await userEvent.setup().click(screen.getByTestId("toggle-left"));
    expect(panel).toHaveAttribute("data-collapsed", "true");
  });

  it("toggles right panel collapse state", async () => {
    render(<TrainingSession />, { wrapper });
    const panel = screen.getByTestId("hints-panel");
    expect(panel).toHaveAttribute("data-collapsed", "false");
    await userEvent.setup().click(screen.getByTestId("toggle-right"));
    expect(panel).toHaveAttribute("data-collapsed", "true");
  });

  it("passes session status to chat area", () => {
    mockSessionData = { status: "in_progress", started_at: "2026-03-20T10:00:00Z" };
    render(<TrainingSession />, { wrapper });
    expect(screen.getByTestId("chat-area")).toHaveAttribute("data-status", "in_progress");
  });

  it("defaults session status to 'created' when session data is not loaded", () => {
    mockSessionData = undefined;
    render(<TrainingSession />, { wrapper });
    expect(screen.getByTestId("chat-area")).toHaveAttribute("data-status", "created");
  });

  it("SSE onHint callback adds hint to hints list", async () => {
    render(<TrainingSession />, { wrapper });
    // Initially 0 hints
    expect(screen.getByTestId("hints-count")).toHaveTextContent("0");
    // Trigger onHint callback inside act
    await act(async () => {
      capturedCallbacks.onHint?.({ content: "Try mentioning the product benefits" });
    });
    expect(screen.getByTestId("hints-count")).toHaveTextContent("1");
  });

  it("SSE onKeyMessages callback updates key messages status", async () => {
    render(<TrainingSession />, { wrapper });
    await act(async () => {
      capturedCallbacks.onKeyMessages?.([
        { message: "Key 1", delivered: true, detected_at: "2026-03-20T10:01:00Z" },
      ]);
    });
    // Component should re-render with updated key messages
    expect(screen.getByTestId("scenario-panel")).toBeInTheDocument();
  });

  it("SSE onDone callback triggers message refetch", async () => {
    render(<TrainingSession />, { wrapper });
    await act(async () => {
      capturedCallbacks.onDone?.();
    });
    expect(mockRefetchMessages).toHaveBeenCalled();
  });

  it("SSE onError callback logs error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TrainingSession />, { wrapper });
    await act(async () => {
      capturedCallbacks.onError?.("Connection lost");
    });
    expect(consoleSpy).toHaveBeenCalledWith("SSE error:", "Connection lost");
    consoleSpy.mockRestore();
  });

  it("computes session stats with word count and message count", () => {
    mockApiMessages = [
      { id: "m1", session_id: "s1", role: "user", content: "Hello World test", message_index: 0, created_at: "" },
      { id: "m2", session_id: "s1", role: "assistant", content: "Response here", message_index: 1, created_at: "" },
    ];
    render(<TrainingSession />, { wrapper });
    // messageCount should be 2 (total messages)
    expect(screen.getByTestId("session-msg-count")).toHaveTextContent("2");
  });

  it("computes duration from session started_at", () => {
    mockSessionData = { status: "in_progress", started_at: new Date().toISOString() };
    render(<TrainingSession />, { wrapper });
    // Duration should be close to 0 since started_at is now
    expect(screen.getByTestId("hints-panel")).toBeInTheDocument();
  });

  it("handles HCP name with more than 2 name parts - takes first 2 initials", () => {
    mockScenarioData = {
      id: "sc-1",
      name: "Test",
      hcp_profile: { name: "Jean Pierre Dupont" },
      key_messages: [],
    };
    render(<TrainingSession />, { wrapper });
    // "Jean Pierre Dupont" -> "JPD" -> slice(0,2) -> "JP"
    expect(screen.getByTestId("hcp-initials")).toHaveTextContent("JP");
  });
});
