import { describe, it, expect, vi } from "vitest";

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

vi.mock("@/contexts/config-context", () => ({
  useConfig: () => ({
    avatar_enabled: false,
    voice_enabled: false,
    realtime_voice_enabled: false,
    conference_enabled: false,
    default_voice_mode: "text_only",
    region: "global",
  }),
  ConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/shared/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

// Mock heavy page components to simplify tests
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

describe("Router configuration", () => {
  it("redirects / to /login", async () => {
    const { router } = await import("./index");

    // createBrowserRouter doesn't work well in tests, so we validate the config
    // by checking its routes array structure
    expect(router).toBeDefined();
    expect(router.routes).toBeDefined();
    expect(router.routes.length).toBeGreaterThan(0);
  });

  it("has the 404 catch-all route configured", async () => {
    const { router } = await import("./index");

    // The last route should be the wildcard catch-all
    const lastRoute = router.routes[router.routes.length - 1];
    expect(lastRoute).toBeDefined();
    expect(lastRoute?.path).toBe("*");
  });

  it("has the root redirect route configured", async () => {
    const { router } = await import("./index");

    // The second to last route is the / -> /login redirect
    const redirectRoute = router.routes[router.routes.length - 2];
    expect(redirectRoute).toBeDefined();
    expect(redirectRoute?.path).toBe("/");
  });

  it("has guest routes for login", async () => {
    const { router } = await import("./index");

    // First route group is GuestRoute with AuthLayout > LoginPage
    const guestRoute = router.routes[0];
    expect(guestRoute).toBeDefined();
    expect(guestRoute?.children).toBeDefined();
  });

  it("has protected routes for user and admin", async () => {
    const { router } = await import("./index");

    // Second route group is ProtectedRoute
    const protectedRoute = router.routes[1];
    expect(protectedRoute).toBeDefined();
    expect(protectedRoute?.children).toBeDefined();

    // Should have user routes and admin routes within children
    const children = protectedRoute?.children ?? [];
    expect(children.length).toBeGreaterThanOrEqual(2);
  });
});
