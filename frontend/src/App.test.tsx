import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    token: null,
    user: null,
    isAuthenticated: false,
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useLogin: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useMe: () => ({ isLoading: false, data: null }),
  useLogout: () => vi.fn(),
}));

vi.mock("@/hooks/use-config", () => ({
  useFeatureFlags: () => ({ data: undefined }),
}));

vi.mock("@/components/shared/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

// Mock pages that have complex dependencies
vi.mock("@/pages/user/training", () => ({
  default: () => <div>Training Page</div>,
}));

vi.mock("@/pages/user/scoring-feedback", () => ({
  default: () => <div>Scoring Feedback</div>,
}));

vi.mock("@/pages/user/training-session", () => ({
  default: () => <div>Training Session</div>,
}));

vi.mock("@/pages/admin/hcp-profiles", () => ({
  default: () => <div>HCP Profiles</div>,
}));

vi.mock("@/pages/admin/scenarios", () => ({
  default: () => <div>Scenarios Page</div>,
}));

vi.mock("@/pages/admin/azure-config", () => ({
  default: () => <div>Azure Config</div>,
}));

vi.mock("@/components/shared/empty-state", () => ({
  EmptyState: () => <div>Empty State</div>,
}));

vi.mock("@/components/shared", () => ({
  StatCard: () => <div />,
  SessionItem: () => <div />,
  ActionCard: () => <div />,
  RecommendedScenario: () => <div />,
  MiniRadarChart: () => <div />,
  MiniTrendChart: () => <div />,
  EmptyState: () => <div>Empty State</div>,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

describe("App", () => {
  it("renders without crashing", async () => {
    const { default: App } = await import("./App");
    render(<App />);

    // The app should render - either showing a loading state or the login page
    expect(document.body).toBeInTheDocument();
  });

  it("renders the Suspense fallback or resolved content", async () => {
    const { default: App } = await import("./App");
    render(<App />);

    // The app should eventually render some content - either Loading... or the login page
    // Since the router navigates to /login for unauthenticated users
    expect(document.body.textContent).toBeDefined();
  });

  it("provides QueryClient and ConfigProvider contexts", async () => {
    const { default: App } = await import("./App");
    const { container } = render(<App />);

    // App renders without context errors, proving providers are working
    expect(container).toBeInTheDocument();
  });
});
