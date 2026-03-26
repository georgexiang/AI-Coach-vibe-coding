import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpeakerLabel } from "./speaker-label";

describe("SpeakerLabel", () => {
  it("renders the speaker name", () => {
    render(<SpeakerLabel speaker="Dr. Chen" colorIndex={0} />);
    expect(screen.getByText("Dr. Chen")).toBeInTheDocument();
  });

  it("applies first color for colorIndex 0", () => {
    render(<SpeakerLabel speaker="Speaker A" colorIndex={0} />);
    const el = screen.getByText("Speaker A");
    expect(el.style.color).toBe("var(--primary)");
  });

  it("applies second color for colorIndex 1", () => {
    render(<SpeakerLabel speaker="Speaker B" colorIndex={1} />);
    const el = screen.getByText("Speaker B");
    expect(el.style.color).toBe("var(--chart-2)");
  });

  it("wraps around color array for large colorIndex", () => {
    // Array has 5 colors, index 5 should wrap to 0
    render(<SpeakerLabel speaker="Speaker C" colorIndex={5} />);
    const el = screen.getByText("Speaker C");
    expect(el.style.color).toBe("var(--primary)");
  });

  it("wraps around for colorIndex 7 (7 % 5 = 2)", () => {
    render(<SpeakerLabel speaker="Speaker D" colorIndex={7} />);
    const el = screen.getByText("Speaker D");
    expect(el.style.color).toBe("var(--chart-3)");
  });

  it("renders as a span element", () => {
    render(<SpeakerLabel speaker="Test" colorIndex={0} />);
    const el = screen.getByText("Test");
    expect(el.tagName).toBe("SPAN");
  });
});
