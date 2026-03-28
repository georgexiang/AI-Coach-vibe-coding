import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceConfigCard } from "./service-config-card";
import { toast } from "sonner";

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    await userEvent.click(screen.getByText("azureConfig.saveConfig"));
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

  // ---- Test connection handler ----

  it("calls onTestConnection and shows success toast on successful test", async () => {
    const onTestConnection = vi.fn().mockResolvedValue({
      service_name: "azure_openai",
      success: true,
      message: "Connection OK",
    });
    render(
      <ServiceConfigCard
        {...defaultProps}
        onTestConnection={onTestConnection}
      />,
    );
    await userEvent.click(screen.getByText("Azure OpenAI"));
    await userEvent.click(screen.getByText("azureConfig.testConnection"));
    expect(onTestConnection).toHaveBeenCalledWith("azure_openai");
    // Wait for async handler to complete
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Connection OK");
    });
  });

  it("shows error toast when test connection returns failure", async () => {
    const onTestConnection = vi.fn().mockResolvedValue({
      service_name: "azure_openai",
      success: false,
      message: "Invalid credentials",
    });
    render(
      <ServiceConfigCard
        {...defaultProps}
        onTestConnection={onTestConnection}
      />,
    );
    await userEvent.click(screen.getByText("Azure OpenAI"));
    await userEvent.click(screen.getByText("azureConfig.testConnection"));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("shows error toast when test connection throws", async () => {
    const onTestConnection = vi
      .fn()
      .mockRejectedValue(new Error("Network error"));
    render(
      <ServiceConfigCard
        {...defaultProps}
        onTestConnection={onTestConnection}
      />,
    );
    await userEvent.click(screen.getByText("Azure OpenAI"));
    await userEvent.click(screen.getByText("azureConfig.testConnection"));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("azureConfig.connectionFailed");
    });
  });

  // ---- Status rendering ----

  it("shows active status dot when savedConfig.is_active is true", () => {
    render(<ServiceConfigCard {...defaultProps} />);
    expect(screen.getByText("Active", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("shows inactive status dot when savedConfig.is_active is false", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        savedConfig={{ ...defaultProps.savedConfig, is_active: false }}
      />,
    );
    expect(screen.getByText("Inactive", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("shows inactive status when no savedConfig is provided", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        savedConfig={undefined}
      />,
    );
    expect(screen.getByText("Inactive", { selector: ".sr-only" })).toBeInTheDocument();
  });

  // ---- Region status display ----

  it("shows region available badge when regionStatus is 'available'", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        regionStatus="available"
      />,
    );
    const badges = screen.getAllByRole("status");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("azureConfig.regionAvailable");
  });

  it("shows region unavailable badge when regionStatus is 'unavailable'", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        regionStatus="unavailable"
      />,
    );
    const badges = screen.getAllByRole("status");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("azureConfig.regionUnavailable");
  });

  it("shows region unknown badge when regionStatus is 'unknown'", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        regionStatus="unknown"
      />,
    );
    const badges = screen.getAllByRole("status");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("azureConfig.regionUnknown");
  });

  it("does not show region badge when regionStatus is provided but no region in savedConfig", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        savedConfig={{ ...defaultProps.savedConfig, region: "" }}
        regionStatus="available"
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show region badge when regionStatus is undefined", () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        regionStatus={undefined}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  // ---- Toggle expand/collapse ----

  it("collapses when header is clicked again", async () => {
    render(<ServiceConfigCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Azure OpenAI"));
    expect(screen.getByText("azureConfig.endpoint")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Azure OpenAI"));
    expect(screen.queryByText("azureConfig.endpoint")).not.toBeInTheDocument();
  });

  // ---- API key visibility toggle ----

  it("toggles API key visibility when eye button is clicked", async () => {
    render(<ServiceConfigCard {...defaultProps} />);
    await userEvent.click(screen.getByText("Azure OpenAI"));

    const apiKeyInput = screen.getByPlaceholderText("Enter API key");
    expect(apiKeyInput).toHaveAttribute("type", "password");

    // Click the toggle button (find parent's button)
    const toggleButton = apiKeyInput
      .closest(".relative")!
      .querySelector("button")!;
    await userEvent.click(toggleButton);
    expect(apiKeyInput).toHaveAttribute("type", "text");

    await userEvent.click(toggleButton);
    expect(apiKeyInput).toHaveAttribute("type", "password");
  });

  // ---- Input value changes ----

  it("allows editing endpoint, apiKey, model, and region fields", async () => {
    const onSave = vi.fn();
    render(
      <ServiceConfigCard
        {...defaultProps}
        savedConfig={undefined}
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByText("Azure OpenAI"));

    const endpointInput = screen.getByPlaceholderText("https://...");
    const apiKeyInput = screen.getByPlaceholderText("Enter API key");
    const modelInput = screen.getByPlaceholderText("gpt-4o");
    const regionInput = screen.getByPlaceholderText("eastus");

    await userEvent.type(endpointInput, "https://my-endpoint.com");
    await userEvent.type(apiKeyInput, "my-secret-key");
    await userEvent.type(modelInput, "gpt-4");
    await userEvent.type(regionInput, "westus");

    await userEvent.click(screen.getByText("azureConfig.saveConfig"));

    expect(onSave).toHaveBeenCalledWith("azure_openai", {
      endpoint: "https://my-endpoint.com",
      api_key: "my-secret-key",
      model_or_deployment: "gpt-4",
      region: "westus",
    });
  });

  // ---- Voice Live mode tests ----

  describe("Voice Live mode", () => {
    const voiceLiveProps = {
      ...defaultProps,
      service: {
        key: "azure_voice_live",
        name: "Azure Voice Live",
        description: "Voice live coaching",
        icon: <span data-testid="voice-icon">VL</span>,
      },
      savedConfig: {
        service_name: "azure_voice_live",
        display_name: "Azure Voice Live",
        endpoint: "https://voice.azure.com",
        masked_key: "vl-****",
        model_or_deployment: "gpt-4o-realtime-preview",
        region: "eastus",
        is_active: true,
        updated_at: "2026-03-27T00:00:00Z",
      },
    };

    it("shows mode radio buttons when service key is azure_voice_live", async () => {
      render(<ServiceConfigCard {...voiceLiveProps} />);
      await userEvent.click(screen.getByText("Azure Voice Live"));

      expect(screen.getByText("voiceLive.modeLabel")).toBeInTheDocument();
      expect(screen.getByText("voiceLive.modelMode")).toBeInTheDocument();
      expect(screen.getByText("voiceLive.agentMode")).toBeInTheDocument();
    });

    it("does not show mode radio buttons for non-voice-live services", async () => {
      render(<ServiceConfigCard {...defaultProps} />);
      await userEvent.click(screen.getByText("Azure OpenAI"));

      expect(screen.queryByText("voiceLive.modeLabel")).not.toBeInTheDocument();
    });

    it("defaults to model mode and shows model input", async () => {
      render(<ServiceConfigCard {...voiceLiveProps} />);
      await userEvent.click(screen.getByText("Azure Voice Live"));

      const radioGroup = screen.getByRole("radiogroup");
      const radios = within(radioGroup).getAllByRole("radio");
      // model mode should be checked
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();

      // model input should be visible
      expect(screen.getByPlaceholderText("gpt-4o")).toBeInTheDocument();
    });

    it("switches to agent mode and hides model input, shows agent fields", async () => {
      render(<ServiceConfigCard {...voiceLiveProps} />);
      await userEvent.click(screen.getByText("Azure Voice Live"));

      // Click agent mode radio
      const agentRadio = screen.getByText("voiceLive.agentMode")
        .closest("label")!
        .querySelector("input")!;
      await userEvent.click(agentRadio);

      // Agent fields appear
      expect(screen.getByText("voiceLive.agentId")).toBeInTheDocument();
      expect(screen.getByText("voiceLive.projectName")).toBeInTheDocument();

      // Model field hidden in agent mode
      expect(screen.queryByPlaceholderText("gpt-4o")).not.toBeInTheDocument();
    });

    it("shows validation errors for empty agent fields in agent mode", async () => {
      render(<ServiceConfigCard {...voiceLiveProps} />);
      await userEvent.click(screen.getByText("Azure Voice Live"));

      // Switch to agent mode
      const agentRadio = screen.getByText("voiceLive.agentMode")
        .closest("label")!
        .querySelector("input")!;
      await userEvent.click(agentRadio);

      // Validation messages should appear (fields are empty)
      expect(
        screen.getByText("voiceLive.agentIdRequired"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("voiceLive.projectNameRequired"),
      ).toBeInTheDocument();
    });

    it("shows error toast when saving agent mode with empty agent fields", async () => {
      const onSave = vi.fn();
      render(
        <ServiceConfigCard {...voiceLiveProps} onSave={onSave} />,
      );
      await userEvent.click(screen.getByText("Azure Voice Live"));

      // Switch to agent mode
      const agentRadio = screen.getByText("voiceLive.agentMode")
        .closest("label")!
        .querySelector("input")!;
      await userEvent.click(agentRadio);

      // Try to save without filling agent fields
      await userEvent.click(screen.getByText("azureConfig.saveConfig"));

      expect(toast.error).toHaveBeenCalledWith("voiceLive.agentIdRequired");
      expect(onSave).not.toHaveBeenCalled();
    });

    it("saves with agent mode encoding when agent fields are filled", async () => {
      const onSave = vi.fn();
      render(
        <ServiceConfigCard {...voiceLiveProps} onSave={onSave} />,
      );
      await userEvent.click(screen.getByText("Azure Voice Live"));

      // Switch to agent mode
      const agentRadio = screen.getByText("voiceLive.agentMode")
        .closest("label")!
        .querySelector("input")!;
      await userEvent.click(agentRadio);

      // Fill in agent fields
      const agentIdInput = screen.getByPlaceholderText(
        "voiceLive.agentIdPlaceholder",
      );
      const projectInput = screen.getByPlaceholderText(
        "voiceLive.projectPlaceholder",
      );
      await userEvent.type(agentIdInput, "my-agent-123");
      await userEvent.type(projectInput, "my-project");

      await userEvent.click(screen.getByText("azureConfig.saveConfig"));

      expect(onSave).toHaveBeenCalledWith("azure_voice_live", {
        endpoint: "https://voice.azure.com",
        api_key: "",
        model_or_deployment: JSON.stringify({
          mode: "agent",
          agent_id: "my-agent-123",
          project_name: "my-project",
        }),
        region: "eastus",
      });
    });

    it("saves with model mode encoding when model mode is selected", async () => {
      const onSave = vi.fn();
      render(
        <ServiceConfigCard {...voiceLiveProps} onSave={onSave} />,
      );
      await userEvent.click(screen.getByText("Azure Voice Live"));

      // Model mode is default, just click save
      await userEvent.click(screen.getByText("azureConfig.saveConfig"));

      expect(onSave).toHaveBeenCalledWith("azure_voice_live", {
        endpoint: "https://voice.azure.com",
        api_key: "",
        model_or_deployment: "gpt-4o-realtime-preview",
        region: "eastus",
      });
    });

    it("initializes with agent mode when savedConfig has agent encoding", async () => {
      const agentConfig = {
        ...voiceLiveProps.savedConfig,
        model_or_deployment: JSON.stringify({
          mode: "agent",
          agent_id: "existing-agent",
          project_name: "existing-project",
        }),
      };
      render(
        <ServiceConfigCard
          {...voiceLiveProps}
          savedConfig={agentConfig}
        />,
      );
      await userEvent.click(screen.getByText("Azure Voice Live"));

      const radioGroup = screen.getByRole("radiogroup");
      const radios = within(radioGroup).getAllByRole("radio");
      // agent mode should be checked
      expect(radios[0]).not.toBeChecked();
      expect(radios[1]).toBeChecked();

      // Agent fields visible and pre-filled
      expect(screen.getByText("voiceLive.agentId")).toBeInTheDocument();
    });

    it("switches from agent mode back to model mode", async () => {
      render(<ServiceConfigCard {...voiceLiveProps} />);
      await userEvent.click(screen.getByText("Azure Voice Live"));

      // Switch to agent mode
      const agentRadio = screen.getByText("voiceLive.agentMode")
        .closest("label")!
        .querySelector("input")!;
      await userEvent.click(agentRadio);
      expect(screen.getByText("voiceLive.agentId")).toBeInTheDocument();

      // Switch back to model mode
      const modelRadio = screen.getByText("voiceLive.modelMode")
        .closest("label")!
        .querySelector("input")!;
      await userEvent.click(modelRadio);
      // Agent fields should be gone, model input back
      expect(
        screen.queryByText("voiceLive.agentId"),
      ).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("gpt-4o")).toBeInTheDocument();
    });
  });

  // ---- Test connection button disabled during testing ----

  it("disables test button while testing is in progress", async () => {
    let resolvePromise: (value: { service_name: string; success: boolean; message: string }) => void;
    const onTestConnection = vi.fn().mockReturnValue(
      new Promise<{ service_name: string; success: boolean; message: string }>(
        (resolve) => {
          resolvePromise = resolve;
        },
      ),
    );
    render(
      <ServiceConfigCard
        {...defaultProps}
        onTestConnection={onTestConnection}
      />,
    );
    await userEvent.click(screen.getByText("Azure OpenAI"));

    const testButton = screen.getByText("azureConfig.testConnection").closest("button")!;
    expect(testButton).not.toBeDisabled();

    await userEvent.click(testButton);
    expect(testButton).toBeDisabled();

    // Resolve the promise inside act
    await act(async () => {
      resolvePromise!({ service_name: "azure_openai", success: true, message: "OK" });
    });

    await vi.waitFor(() => {
      expect(testButton).not.toBeDisabled();
    });
  });

  // ---- No masked key when not in savedConfig ----

  it("does not show masked key text when savedConfig has no masked_key", async () => {
    render(
      <ServiceConfigCard
        {...defaultProps}
        savedConfig={{ ...defaultProps.savedConfig, masked_key: "" }}
      />,
    );
    await userEvent.click(screen.getByText("Azure OpenAI"));
    expect(screen.queryByText(/Current key:/)).not.toBeInTheDocument();
  });
});
