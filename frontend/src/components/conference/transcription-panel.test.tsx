import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

function makeLine(speaker: string, text: string): TranscriptLine {
  return {
    speaker,
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
      await userEvent.click(screen.getByLabelText("ariaCollapseTranscript"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("renders a region with aria-live polite", () => {
      render(<TranscriptionPanel {...defaultProps} />);
      const region = screen.getByRole("region");
      expect(region).toHaveAttribute("aria-live", "polite");
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
      expect(screen.queryByTestId("transcription-line")).not.toBeInTheDocument();
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
      await userEvent.click(screen.getByLabelText("ariaExpandTranscript"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
