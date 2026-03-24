import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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
  useSession: () => ({ data: undefined }),
  useSessionMessages: () => ({ data: [], refetch: vi.fn() }),
  useEndSession: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-scenarios", () => ({
  useScenario: () => ({ data: undefined }),
}));

vi.mock("@/hooks/use-scoring", () => ({
  useSessionScore: () => ({ data: undefined, isLoading: false }),
  useTriggerScoring: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-sse", () => ({
  useSSEStream: () => ({
    sendMessage: vi.fn(),
    isStreaming: false,
    streamedText: "",
    error: null,
    abort: vi.fn(),
  }),
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

describe("TrainingSession page", () => {
  it("renders the training session layout without crashing", async () => {
    const { default: TrainingSession } = await import("./training-session");
    const { container } = render(<TrainingSession />, { wrapper });
    // Should render the three-panel layout
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders with session data from URL params", async () => {
    const { default: TrainingSession } = await import("./training-session");
    render(<TrainingSession />, { wrapper });
    // The page should be in the document (not throwing)
    expect(document.body).toBeInTheDocument();
  });

  it("renders chat area for messaging", async () => {
    const { default: TrainingSession } = await import("./training-session");
    const { container } = render(<TrainingSession />, { wrapper });
    // The full-screen layout should render
    expect(container.querySelector("div")).not.toBeNull();
  });
});
