import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceConfigCard } from "./service-config-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ServiceConfigCard", () => {
  const defaultProps = {
    service: {
      name: "Azure OpenAI",
      description: "GPT-4 service",
      icon: <span data-testid="service-icon">AI</span>,
      status: "active" as const,
    },
    config: {
      endpoint: "https://api.openai.com",
      apiKey: "sk-test",
      model: "gpt-4o",
      region: "eastus",
    },
    onSave: vi.fn(),
    onTestConnection: vi.fn().mockResolvedValue(true),
  };

  it("renders service name and description", () => {
    render(<ServiceConfigCard {...defaultProps} />);
    expect(screen.getByText("Azure OpenAI")).toBeInTheDocument();
    expect(screen.getByText("GPT-4 service")).toBeInTheDocument();
  });

  it("renders service icon", () => {
    render(<ServiceConfigCard {...defaultProps} />);
    expect(screen.getByTestId("service-icon")).toBeInTheDocument();
  });

  it("does not show config form initially (collapsed)", () => {
    render(<ServiceConfigCard {...defaultProps} />);
    expect(screen.queryByText("azureConfig.endpoint")).not.toBeInTheDocument();
  });

  it("expands to show config form when header is clicked", async () => {
    render(<ServiceConfigCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Azure OpenAI"));
    expect(screen.getByText("azureConfig.endpoint")).toBeInTheDocument();
    expect(screen.getByText("azureConfig.apiKey")).toBeInTheDocument();
    expect(screen.getByText("azureConfig.model")).toBeInTheDocument();
    expect(screen.getByText("azureConfig.region")).toBeInTheDocument();
  });

  it("calls onSave when Save button is clicked", async () => {
    const onSave = vi.fn();
    render(<ServiceConfigCard {...defaultProps} onSave={onSave} />);
    await userEvent.click(screen.getByText("Azure OpenAI"));
    await userEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(defaultProps.config);
  });
});
