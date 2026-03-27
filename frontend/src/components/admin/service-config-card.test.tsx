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
      key: "azure_openai",
      name: "Azure OpenAI",
      description: "GPT-4 service",
      icon: <span data-testid="service-icon">AI</span>,
    },
    savedConfig: {
      service_name: "azure_openai",
      display_name: "Azure OpenAI",
      endpoint: "https://api.openai.com",
      masked_key: "sk-****test",
      model_or_deployment: "gpt-4o",
      region: "eastus",
      is_active: true,
      updated_at: "2026-03-27T00:00:00Z",
    },
    onSave: vi.fn(),
    onTestConnection: vi.fn().mockResolvedValue({
      service_name: "azure_openai",
      success: true,
      message: "Connected",
    }),
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

  it("calls onSave with service key and config when Save button is clicked", async () => {
    const onSave = vi.fn();
    render(<ServiceConfigCard {...defaultProps} onSave={onSave} />);
    await userEvent.click(screen.getByText("Azure OpenAI"));
    await userEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("azure_openai", {
      endpoint: "https://api.openai.com",
      api_key: "",
      model_or_deployment: "gpt-4o",
      region: "eastus",
    });
  });

  it("shows masked key when savedConfig is provided", async () => {
    render(<ServiceConfigCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Azure OpenAI"));
    expect(screen.getByText("Current key: sk-****test")).toBeInTheDocument();
  });
});
