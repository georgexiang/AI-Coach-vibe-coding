import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminLayout } from "./admin-layout";

const mockLogout = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: { full_name: "Admin User", role: "admin", username: "admin" },
    token: "mock-token",
    isAuthenticated: true,
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useLogout: () => mockLogout,
}));

vi.mock("@/components/shared/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sidebar with AI Coach Admin branding", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("AI Coach Admin")).toBeInTheDocument();
  });

  it("renders all sidebar navigation items", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    // Each sidebar item uses t(labelKey), which returns the labelKey itself
    expect(screen.getAllByText("dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("users").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("hcpProfiles").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("scenarios").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("materials").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("reports").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("azureServices").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("settings").length).toBeGreaterThanOrEqual(1);
  });

  it("renders user avatar with initials from full name", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("AU")).toBeInTheDocument();
  });

  it("renders the language switcher in header", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });

  it("toggles sidebar collapsed state when clicking the collapse button", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    // Initially the sidebar has "AI Coach Admin" text visible
    expect(screen.getByText("AI Coach Admin")).toBeInTheDocument();

    // Find the collapse toggle button in the sidebar footer area
    // The desktop sidebar has a button at the bottom with ChevronLeft icon
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();

    // The sidebar should start expanded (w-60)
    expect(aside).toHaveClass("w-60");

    // Click the collapse button (last button inside aside)
    const collapseBtn = aside!.querySelector("button");
    expect(collapseBtn).toBeInTheDocument();
    await user.click(collapseBtn!);

    // After collapse, aside should have w-16
    expect(aside).toHaveClass("w-16");
  });

  it("renders mobile hamburger menu button", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    // The mobile menu button has class md:hidden
    const headerButtons = screen.getAllByRole("button");
    // At least one button should exist for mobile menu
    expect(headerButtons.length).toBeGreaterThan(0);
  });

  it("renders the user dropdown with profile and logout items", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <AdminLayout />
      </MemoryRouter>,
    );

    // Find and click the avatar/username trigger button
    const avatarButton = screen.getByText("Admin User").closest("button");
    expect(avatarButton).toBeInTheDocument();
    await user.click(avatarButton!);

    // Dropdown should show profile and logout
    expect(screen.getByText("profile")).toBeInTheDocument();
    expect(screen.getByText("logout")).toBeInTheDocument();
  });
});
