import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceConfigPanel } from "./voice-config-panel";
import type { VoiceConfigSettings } from "@/types/voice-live";

// ---- Mocks ----

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => `voice.${key}`,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("lucide-react", () => ({
  Globe: (props: Record<string, unknown>) => <svg data-testid="globe-icon" {...props} />,
  Volume2: (props: Record<string, unknown>) => <svg data-testid="volume-icon" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronUp: (props: Record<string, unknown>) => <svg data-testid="chevron-up" {...props} />,
}));

// Mock UI components
vi.mock("@/components/ui", () => ({
  ScrollArea: ({ children, className, ...rest }: { children: React.ReactNode; className?: string; "data-testid"?: string }) => (
    <div data-testid={rest["data-testid"] ?? "scroll-area"} className={className}>{children}</div>
  ),
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      {/* Render children and pass onValueChange via a hidden button */}
      {children}
      <button
        data-testid="select-change-trigger"
        onClick={() => onValueChange?.("en-US")}
        style={{ display: "none" }}
      >
        change
      </button>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <div data-testid={`select-item-${value}`} data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: string;
    className?: string;
    "data-testid"?: string;
  }) => (
    <button data-testid="language-select" id={id}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  Switch: ({
    checked,
    onCheckedChange,
    id,
    ...rest
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    id?: string;
    "data-testid"?: string;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      data-testid={rest["data-testid"] ?? `switch-${id}`}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
  Separator: ({ className }: { className?: string }) => (
    <hr data-testid="separator" className={className} />
  ),
  Badge: ({
    children,
    variant,
    ...rest
  }: {
    children: React.ReactNode;
    variant?: string;
    "data-testid"?: string;
  }) => (
    <span data-testid={rest["data-testid"] ?? "badge"} data-variant={variant}>
      {children}
    </span>
  ),
}));

// ---- Helpers ----

const defaultConfig: VoiceConfigSettings = {
  language: "zh-CN",
  autoDetect: false,
  interimResponse: true,
  proactiveEngagement: false,
};

function renderPanel(
  overrides: Partial<{
    config: VoiceConfigSettings;
    onConfigChange: (c: VoiceConfigSettings) => void;
    voiceName: string;
    avatarEnabled: boolean;
  }> = {},
) {
  const props = {
    config: overrides.config ?? defaultConfig,
    onConfigChange: overrides.onConfigChange ?? vi.fn(),
    voiceName: overrides.voiceName ?? "Ava Dragon HD",
    avatarEnabled: overrides.avatarEnabled ?? true,
  };
  return { ...render(<VoiceConfigPanel {...props} />), props };
}

// ---- Tests ----

describe("VoiceConfigPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======== Rendering ========

  describe("rendering", () => {
    it("renders the config panel with all sections", () => {
      renderPanel();

      expect(screen.getByTestId("voice-config-panel")).toBeInTheDocument();
      // Speech input section
      expect(screen.getByText("voice.config.speechInput")).toBeInTheDocument();
      // Speech output section
      expect(screen.getByText("voice.config.speechOutput")).toBeInTheDocument();
      // Interim response
      expect(screen.getByText("voice.config.interimResponse")).toBeInTheDocument();
      // Proactive engagement
      expect(screen.getByText("voice.config.proactiveEngagement")).toBeInTheDocument();
      // Avatar status
      expect(screen.getByText("voice.config.avatarStatus")).toBeInTheDocument();
    });

    it("renders language selector", () => {
      renderPanel();
      expect(screen.getByTestId("language-select")).toBeInTheDocument();
    });

    it("renders auto-detect switch", () => {
      renderPanel();
      expect(screen.getByTestId("auto-detect-switch")).toBeInTheDocument();
    });

    it("renders interim response switch", () => {
      renderPanel();
      expect(screen.getByTestId("interim-response-switch")).toBeInTheDocument();
    });

    it("renders proactive engagement switch", () => {
      renderPanel();
      expect(screen.getByTestId("proactive-engagement-switch")).toBeInTheDocument();
    });

    it("displays voice name in read-only field", () => {
      renderPanel({ voiceName: "Ava Dragon HD" });
      expect(screen.getByTestId("voice-name-display")).toHaveTextContent("Ava Dragon HD");
    });

    it("displays 'Default' when voice name is empty", () => {
      renderPanel({ voiceName: "" });
      expect(screen.getByTestId("voice-name-display")).toHaveTextContent("Default");
    });

    it("shows avatar enabled badge when avatar is enabled", () => {
      renderPanel({ avatarEnabled: true });
      const badge = screen.getByTestId("avatar-status-badge");
      expect(badge).toHaveTextContent("voice.config.avatarEnabled");
      expect(badge).toHaveAttribute("data-variant", "default");
    });

    it("shows avatar disabled badge when avatar is disabled", () => {
      renderPanel({ avatarEnabled: false });
      const badge = screen.getByTestId("avatar-status-badge");
      expect(badge).toHaveTextContent("voice.config.avatarDisabled");
      expect(badge).toHaveAttribute("data-variant", "secondary");
    });

    it("renders language options for all supported languages", () => {
      renderPanel();
      expect(screen.getByTestId("select-item-auto")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-zh-CN")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-en-US")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-ja-JP")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-ko-KR")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-de-DE")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-fr-FR")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-es-ES")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-it-IT")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-pt-BR")).toBeInTheDocument();
      expect(screen.getByTestId("select-item-en-GB")).toBeInTheDocument();
    });

    it("renders separators between sections", () => {
      renderPanel();
      const separators = screen.getAllByTestId("separator");
      expect(separators.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ======== Switch interactions ========

  describe("switch interactions", () => {
    it("calls onConfigChange when auto-detect is toggled on", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderPanel({ onConfigChange: onChange });

      await user.click(screen.getByTestId("auto-detect-switch"));

      expect(onChange).toHaveBeenCalledWith({
        ...defaultConfig,
        autoDetect: true,
        language: "auto",
      });
    });

    it("calls onConfigChange when auto-detect is toggled off", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderPanel({
        config: { ...defaultConfig, autoDetect: true, language: "auto" },
        onConfigChange: onChange,
      });

      await user.click(screen.getByTestId("auto-detect-switch"));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          autoDetect: false,
          language: "zh-CN",
        }),
      );
    });

    it("calls onConfigChange when interim response is toggled", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderPanel({ onConfigChange: onChange });

      await user.click(screen.getByTestId("interim-response-switch"));

      expect(onChange).toHaveBeenCalledWith({
        ...defaultConfig,
        interimResponse: false,
      });
    });

    it("calls onConfigChange when proactive engagement is toggled", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderPanel({ onConfigChange: onChange });

      await user.click(screen.getByTestId("proactive-engagement-switch"));

      expect(onChange).toHaveBeenCalledWith({
        ...defaultConfig,
        proactiveEngagement: true,
      });
    });

    it("reflects interimResponse=true as checked", () => {
      renderPanel({ config: { ...defaultConfig, interimResponse: true } });
      expect(screen.getByTestId("interim-response-switch")).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });

    it("reflects proactiveEngagement=false as unchecked", () => {
      renderPanel({ config: { ...defaultConfig, proactiveEngagement: false } });
      expect(screen.getByTestId("proactive-engagement-switch")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
  });

  // ======== Advanced settings ========

  describe("advanced settings", () => {
    it("does not show input advanced content by default", () => {
      renderPanel();
      expect(screen.queryByTestId("input-advanced-content")).not.toBeInTheDocument();
    });

    it("shows input advanced content when toggle is clicked", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByTestId("input-advanced-toggle"));

      expect(screen.getByTestId("input-advanced-content")).toBeInTheDocument();
    });

    it("hides input advanced content on second toggle click", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByTestId("input-advanced-toggle"));
      expect(screen.getByTestId("input-advanced-content")).toBeInTheDocument();

      await user.click(screen.getByTestId("input-advanced-toggle"));
      expect(screen.queryByTestId("input-advanced-content")).not.toBeInTheDocument();
    });

    it("does not show output advanced content by default", () => {
      renderPanel();
      expect(screen.queryByTestId("output-advanced-content")).not.toBeInTheDocument();
    });

    it("shows output advanced content when toggle is clicked", async () => {
      const user = userEvent.setup();
      renderPanel();

      await user.click(screen.getByTestId("output-advanced-toggle"));

      expect(screen.getByTestId("output-advanced-content")).toBeInTheDocument();
    });
  });

  // ======== Voice read-only ========

  describe("voice name display", () => {
    it("shows read-only notice for voice configuration", () => {
      renderPanel();
      expect(screen.getByText("voice.config.voiceReadOnly")).toBeInTheDocument();
    });
  });
});
