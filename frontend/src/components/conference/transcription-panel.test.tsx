import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranscriptionPanel } from "./transcription-panel";
import type { TranscriptLine } from "@/types/conference";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("./transcription-line", () => ({
  TranscriptionLine: ({
    line,
    speakerIndex,
  }: {
    line: TranscriptLine;
    speakerIndex: number;
  }) => (
    <div data-testid="transcription-line" data-speaker-index={speakerIndex}>
      {line.speaker}: {line.text}
    </div>
  ),
}));

function makeLine(
  speaker: string,
  text: string,
  speakerId?: string,
): TranscriptLine {
  return {
    speaker,
    speakerId,
    text,
    timestamp: new Date(2024, 0, 1, 10, 0, 0),
  };
}

describe("TranscriptionPanel", () => {
  const defaultProps = {
    lines: [] as TranscriptLine[],
    isCollapsed: false,
    onToggle: vi.fn(),
    speakerMap: new Map<string, number>(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when expanded", () => {
    it("renders the heading with translation key", () => {
      render(<TranscriptionPanel {...defaultProps} />);
      expect(screen.getByText("transcription")).toBeInTheDocument();
    });

    it("renders empty transcription message when no lines", () => {
      render(<TranscriptionPanel {...defaultProps} />);
      expect(screen.getByText("emptyTranscription")).toBeInTheDocument();
    });

    it("renders transcription lines when provided", () => {
      const lines = [
        makeLine("Dr. A", "Hello"),
        makeLine("Dr. B", "Welcome"),
      ];
      const speakerMap = new Map([
        ["Dr. A", 0],
        ["Dr. B", 1],
      ]);
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          speakerMap={speakerMap}
        />,
      );
      const lineEls = screen.getAllByTestId("transcription-line");
      expect(lineEls).toHaveLength(2);
      expect(screen.getByText("Dr. A: Hello")).toBeInTheDocument();
      expect(screen.getByText("Dr. B: Welcome")).toBeInTheDocument();
    });

    it("passes correct speakerIndex from speakerMap", () => {
      const lines = [makeLine("Dr. A", "Test")];
      const speakerMap = new Map([["Dr. A", 3]]);
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          speakerMap={speakerMap}
        />,
      );
      const lineEl = screen.getByTestId("transcription-line");
      expect(lineEl).toHaveAttribute("data-speaker-index", "3");
    });

    it("defaults speakerIndex to 0 when speaker not in map", () => {
      const lines = [makeLine("Unknown", "Test")];
      const speakerMap = new Map<string, number>();
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          speakerMap={speakerMap}
        />,
      );
      const lineEl = screen.getByTestId("transcription-line");
      expect(lineEl).toHaveAttribute("data-speaker-index", "0");
    });

    it("renders collapse button with aria-label", () => {
      render(<TranscriptionPanel {...defaultProps} />);
      expect(
        screen.getByLabelText("ariaCollapseTranscript"),
      ).toBeInTheDocument();
    });

    it("calls onToggle when collapse button is clicked", async () => {
      const onToggle = vi.fn();
      render(<TranscriptionPanel {...defaultProps} onToggle={onToggle} />);
      await userEvent.click(
        screen.getByLabelText("ariaCollapseTranscript"),
      );
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("renders a region with aria-live polite", () => {
      render(<TranscriptionPanel {...defaultProps} />);
      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("aria-live", "polite");
    });

    it("uses speakerId to look up speakerMap when available", () => {
      const lines = [makeLine("Dr. A Display", "Test", "speaker-id-1")];
      const speakerMap = new Map([
        ["speaker-id-1", 5],
        ["Dr. A Display", 2],
      ]);
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          speakerMap={speakerMap}
        />,
      );
      const lineEl = screen.getByTestId("transcription-line");
      // Should use speakerId first: 5
      expect(lineEl).toHaveAttribute("data-speaker-index", "5");
    });

    it("defaults to 0 when speakerId is present but not in map", () => {
      const lines = [makeLine("Dr. A", "Test", "unknown-id")];
      const speakerMap = new Map([["Dr. A", 4]]);
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          speakerMap={speakerMap}
        />,
      );
      const lineEl = screen.getByTestId("transcription-line");
      // speakerId "unknown-id" takes priority via ??, but it's not in map -> defaults to 0
      expect(lineEl).toHaveAttribute("data-speaker-index", "0");
    });

    it("falls back to speaker name when speakerId is undefined", () => {
      const lines = [makeLine("Dr. A", "Test")]; // no speakerId
      const speakerMap = new Map([["Dr. A", 2]]);
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          speakerMap={speakerMap}
        />,
      );
      const lineEl = screen.getByTestId("transcription-line");
      expect(lineEl).toHaveAttribute("data-speaker-index", "2");
    });

    it("does not show empty transcription message when lines exist", () => {
      const lines = [makeLine("Dr. A", "Hello")];
      render(
        <TranscriptionPanel {...defaultProps} lines={lines} />,
      );
      expect(
        screen.queryByText("emptyTranscription"),
      ).not.toBeInTheDocument();
    });

    // ── Scroll behavior: Jump to latest button ──
    it("does not show jump to latest button by default", () => {
      render(<TranscriptionPanel {...defaultProps} />);
      expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument();
    });

    it("shows jump to latest button when scrolled away from bottom", () => {
      const lines = Array.from({ length: 20 }, (_, i) =>
        makeLine("Dr. A", `Line ${i}`),
      );
      render(
        <TranscriptionPanel {...defaultProps} lines={lines} />,
      );

      // Find the scroll container (div with onScroll handler)
      const scrollContainer = screen
        .getAllByTestId("transcription-line")[0]
        ?.closest("[class*='space-y']");

      if (scrollContainer) {
        // Simulate scrolling away from bottom
        Object.defineProperty(scrollContainer, "scrollHeight", {
          value: 2000,
          configurable: true,
        });
        Object.defineProperty(scrollContainer, "scrollTop", {
          value: 100,
          configurable: true,
        });
        Object.defineProperty(scrollContainer, "clientHeight", {
          value: 400,
          configurable: true,
        });
        fireEvent.scroll(scrollContainer);
      }

      // The showJumpButton state should be true now
      expect(screen.getByText("Jump to latest")).toBeInTheDocument();
    });

    it("hides jump button when clicking it", async () => {
      const lines = Array.from({ length: 20 }, (_, i) =>
        makeLine("Dr. A", `Line ${i}`),
      );
      render(
        <TranscriptionPanel {...defaultProps} lines={lines} />,
      );

      // Get the scroll container and simulate scroll
      const scrollContainer = screen
        .getAllByTestId("transcription-line")[0]
        ?.closest("[class*='space-y']");

      if (scrollContainer) {
        Object.defineProperty(scrollContainer, "scrollHeight", {
          value: 2000,
          configurable: true,
        });
        Object.defineProperty(scrollContainer, "scrollTop", {
          value: 100,
          configurable: true,
        });
        Object.defineProperty(scrollContainer, "clientHeight", {
          value: 400,
          configurable: true,
        });
        fireEvent.scroll(scrollContainer);
      }

      const jumpBtn = screen.getByText("Jump to latest");
      expect(jumpBtn).toBeInTheDocument();

      await userEvent.click(jumpBtn);
      expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument();
    });

    it("does not show jump button when near bottom", () => {
      const lines = Array.from({ length: 5 }, (_, i) =>
        makeLine("Dr. A", `Line ${i}`),
      );
      render(
        <TranscriptionPanel {...defaultProps} lines={lines} />,
      );

      const scrollContainer = screen
        .getAllByTestId("transcription-line")[0]
        ?.closest("[class*='space-y']");

      if (scrollContainer) {
        // Near bottom: scrollHeight - scrollTop - clientHeight < 50
        Object.defineProperty(scrollContainer, "scrollHeight", {
          value: 500,
          configurable: true,
        });
        Object.defineProperty(scrollContainer, "scrollTop", {
          value: 460,
          configurable: true,
        });
        Object.defineProperty(scrollContainer, "clientHeight", {
          value: 400,
          configurable: true,
        });
        fireEvent.scroll(scrollContainer);
      }

      expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument();
    });
  });

  describe("when collapsed", () => {
    it("renders expand button with aria-label", () => {
      render(<TranscriptionPanel {...defaultProps} isCollapsed={true} />);
      expect(
        screen.getByLabelText("ariaExpandTranscript"),
      ).toBeInTheDocument();
    });

    it("does not render transcription lines", () => {
      const lines = [makeLine("Dr. A", "Test")];
      render(
        <TranscriptionPanel
          {...defaultProps}
          lines={lines}
          isCollapsed={true}
        />,
      );
      expect(
        screen.queryByTestId("transcription-line"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("transcription")).not.toBeInTheDocument();
    });

    it("calls onToggle when expand button is clicked", async () => {
      const onToggle = vi.fn();
      render(
        <TranscriptionPanel
          {...defaultProps}
          isCollapsed={true}
          onToggle={onToggle}
        />,
      );
      await userEvent.click(
        screen.getByLabelText("ariaExpandTranscript"),
      );
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("does not render the heading when collapsed", () => {
      render(<TranscriptionPanel {...defaultProps} isCollapsed={true} />);
      expect(screen.queryByText("transcription")).not.toBeInTheDocument();
    });

    it("does not render empty transcription message when collapsed", () => {
      render(<TranscriptionPanel {...defaultProps} isCollapsed={true} />);
      expect(
        screen.queryByText("emptyTranscription"),
      ).not.toBeInTheDocument();
    });

    it("does not render region when collapsed", () => {
      render(<TranscriptionPanel {...defaultProps} isCollapsed={true} />);
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });

    it("does not show jump to latest button when collapsed", () => {
      render(<TranscriptionPanel {...defaultProps} isCollapsed={true} />);
      expect(screen.queryByText("Jump to latest")).not.toBeInTheDocument();
    });
  });
});
