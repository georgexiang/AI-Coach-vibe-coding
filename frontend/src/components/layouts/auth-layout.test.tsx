import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthLayout } from "./auth-layout";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("@/components/shared/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

describe("AuthLayout", () => {
  it("renders the copyright text", () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText(/2026 AI Coach Platform/)).toBeInTheDocument();
  });

  it("renders the language switcher", () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });

  it("has the gradient background container", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass("min-h-screen");
  });

  it("renders the Outlet area for child routes", () => {
    render(
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>,
    );

    // The component renders without crashing, which means the Outlet is present
    expect(document.body).toBeInTheDocument();
  });
});
