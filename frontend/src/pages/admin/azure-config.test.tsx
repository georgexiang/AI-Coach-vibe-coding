import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import AzureConfigPage from "./azure-config";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockOnSave = vi.fn();
const mockOnTestConnection = vi.fn();

vi.mock("@/components/admin/service-config-card", () => ({
  ServiceConfigCard: (props: {
    service: { name: string; description: string };
    config: Record<string, string>;
    onSave: (config: Record<string, string>) => void;
    onTestConnection: () => Promise<boolean>;
  }) => (
    <div data-testid={`service-card-${props.service.name}`}>
      <span>{props.service.name}</span>
      <span>{props.service.description}</span>
      <button
        onClick={() => {
          mockOnSave(props.config);
          props.onSave(props.config);
        }}
      >
        Save {props.service.name}
      </button>
      <button
        onClick={() => {
          mockOnTestConnection();
          props.onTestConnection();
        }}
      >
        Test {props.service.name}
      </button>
    </div>
  ),
}));

describe("AzureConfigPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page title", () => {
    render(<AzureConfigPage />);
    expect(screen.getByText("azureConfig.title")).toBeInTheDocument();
  });

  it("renders Test All Connections button", () => {
    render(<AzureConfigPage />);
    expect(screen.getByText("Test All Connections")).toBeInTheDocument();
  });

  it("renders all 7 Azure service cards", () => {
    render(<AzureConfigPage />);
    expect(screen.getByText("Azure OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Azure Speech (STT)")).toBeInTheDocument();
    expect(screen.getByText("Azure Speech (TTS)")).toBeInTheDocument();
    expect(screen.getByText("Azure AI Avatar")).toBeInTheDocument();
    expect(screen.getByText("Azure Content Understanding")).toBeInTheDocument();
    expect(screen.getByText("Azure OpenAI Realtime")).toBeInTheDocument();
    expect(screen.getByText("Azure Database for PostgreSQL")).toBeInTheDocument();
  });

  it("calls onSave when saving a card config", async () => {
    render(<AzureConfigPage />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Save Azure OpenAI"));
    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it("Test All button becomes disabled while testing", async () => {
    // Make the internal test promise hang for a bit
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AzureConfigPage />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const btn = screen.getByText("Test All Connections");
    await user.click(btn);
    // Button should be disabled while testing
    expect(btn.closest("button")).toBeDisabled();
    // Let the timeout resolve
    await vi.advanceTimersByTimeAsync(2000);
    expect(btn.closest("button")).toBeEnabled();
    vi.useRealTimers();
  });

  it("calls onTestConnection when testing a service", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AzureConfigPage />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByText("Test Azure OpenAI"));
    expect(mockOnTestConnection).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("renders all service descriptions", () => {
    render(<AzureConfigPage />);
    expect(screen.getByText("GPT-4o for AI coaching conversations and scoring")).toBeInTheDocument();
    expect(screen.getByText("Speech-to-text for voice input recognition")).toBeInTheDocument();
    expect(screen.getByText("Text-to-speech for HCP voice responses")).toBeInTheDocument();
    expect(screen.getByText("Digital human avatar for HCP visualization")).toBeInTheDocument();
    expect(screen.getByText("Multimodal evaluation for training materials")).toBeInTheDocument();
    expect(screen.getByText("Real-time audio streaming for voice conversations")).toBeInTheDocument();
    expect(screen.getByText("Managed PostgreSQL database for production data")).toBeInTheDocument();
  });
});
