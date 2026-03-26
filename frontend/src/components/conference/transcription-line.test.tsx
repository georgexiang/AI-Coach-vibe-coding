import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptionLine } from "./transcription-line";
import type { TranscriptLine } from "@/types/conference";

vi.mock("./speaker-label", () => ({
  SpeakerLabel: ({ speaker, colorIndex }: { speaker: string; colorIndex: number }) => (
    <span data-testid="speaker-label" data-color-index={colorIndex}>
      {speaker}
    </span>
  ),
}));

function makeLine(overrides: Partial<TranscriptLine> = {}): TranscriptLine {
  return {
    speaker: "Dr. Wang",
    text: "This is what I said",
    timestamp: new Date(2024, 5, 15, 14, 30, 45),
    ...overrides,
  };
}

describe("TranscriptionLine", () => {
  it("renders the transcript text", () => {
    render(<TranscriptionLine line={makeLine()} speakerIndex={0} />);
    expect(screen.getByText("This is what I said")).toBeInTheDocument();
  });

  it("renders speaker label with correct speaker name", () => {
    render(<TranscriptionLine line={makeLine({ speaker: "Dr. Lee" })} speakerIndex={2} />);
    const label = screen.getByTestId("speaker-label");
    expect(label).toHaveTextContent("Dr. Lee");
    expect(label).toHaveAttribute("data-color-index", "2");
  });

  it("formats timestamp as HH:MM:SS", () => {
    render(
      <TranscriptionLine
        line={makeLine({ timestamp: new Date(2024, 0, 1, 9, 5, 3) })}
        speakerIndex={0}
      />,
    );
    expect(screen.getByText("09:05:03")).toBeInTheDocument();
  });

  it("pads single-digit hours, minutes, and seconds", () => {
    render(
      <TranscriptionLine
        line={makeLine({ timestamp: new Date(2024, 0, 1, 1, 2, 3) })}
        speakerIndex={0}
      />,
    );
    expect(screen.getByText("01:02:03")).toBeInTheDocument();
  });

  it("handles midnight time correctly", () => {
    render(
      <TranscriptionLine
        line={makeLine({ timestamp: new Date(2024, 0, 1, 0, 0, 0) })}
        speakerIndex={0}
      />,
    );
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });
});
