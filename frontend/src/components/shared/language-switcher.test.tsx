import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const changeLanguageMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: changeLanguageMock, language: "en" },
  }),
}));

import { LanguageSwitcher } from "./language-switcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    changeLanguageMock.mockClear();
  });

  it("renders the trigger button with switch language aria-label", () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole("button", { name: /switch language/i });
    expect(button).toBeInTheDocument();
  });

  it("opens dropdown and shows language options when trigger is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    // Translation keys are rendered as-is by the mock
    expect(screen.getByText("lang.zhCN")).toBeInTheDocument();
    expect(screen.getByText("lang.enUS")).toBeInTheDocument();
  });

  it("calls changeLanguage with zh-CN when Chinese option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const zhOption = screen.getByText("lang.zhCN");
    await userEvent.click(zhOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("zh-CN");
  });

  it("calls changeLanguage with en-US when English option is clicked", async () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /switch language/i });
    await userEvent.click(trigger);

    const enOption = screen.getByText("lang.enUS");
    await userEvent.click(enOption);
    expect(changeLanguageMock).toHaveBeenCalledWith("en-US");
  });
});
