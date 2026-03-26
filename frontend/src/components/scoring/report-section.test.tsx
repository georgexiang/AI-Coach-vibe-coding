import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportSection } from "./report-section";
import type { ImprovementSuggestion } from "@/types/report";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

const mockImprovements: ImprovementSuggestion[] = [
  {
    dimension: "Product Knowledge",
    priority: "high",
    suggestion: "Study the clinical trial data more thoroughly",
    example: "For instance, review the Phase III results",
  },
  {
    dimension: "Communication",
    priority: "medium",
    suggestion: "Use more open-ended questions",
  },
  {
    dimension: "Objection Handling",
    priority: "low",
    suggestion: "Good handling of safety concerns",
  },
  {
    dimension: "Closing",
    priority: "high",
    suggestion: "Be more assertive in asking for commitment",
    example: "Ask directly for the prescription change",
  },
];

describe("ReportSection", () => {
  it("renders key messages delivery count", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    expect(screen.getByText("report.keyMessages:")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("renders green progress bar when delivery rate >= 70%", () => {
    const { container } = render(
      <ReportSection
        improvements={[]}
        keyMessagesDelivered={4}
        keyMessagesTotal={5}
      />,
    );
    const progressBar = container.querySelector(".bg-green-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("renders orange progress bar when delivery rate < 70%", () => {
    const { container } = render(
      <ReportSection
        improvements={[]}
        keyMessagesDelivered={2}
        keyMessagesTotal={5}
      />,
    );
    const progressBar = container.querySelector(".bg-orange-500");
    expect(progressBar).toBeInTheDocument();
  });

  it("renders improvements grouped by priority", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    // Priority labels
    expect(screen.getByText("report.highPriority")).toBeInTheDocument();
    expect(screen.getByText("report.mediumPriority")).toBeInTheDocument();
    expect(screen.getByText("report.lowPriority")).toBeInTheDocument();
  });

  it("renders correct count for each priority group", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    // 2 high, 1 medium, 1 low
    expect(screen.getByText("(2)")).toBeInTheDocument();
    const oneCounts = screen.getAllByText("(1)");
    expect(oneCounts).toHaveLength(2);
  });

  it("renders suggestion text", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    expect(
      screen.getByText("Study the clinical trial data more thoroughly"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Use more open-ended questions"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Good handling of safety concerns"),
    ).toBeInTheDocument();
  });

  it("renders dimension names", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    expect(screen.getByText("Product Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Communication")).toBeInTheDocument();
    expect(screen.getByText("Objection Handling")).toBeInTheDocument();
    expect(screen.getByText("Closing")).toBeInTheDocument();
  });

  it("renders example text when provided", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    // Examples are rendered inside quotes
    expect(
      screen.getByText(/For instance, review the Phase III results/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ask directly for the prescription change/),
    ).toBeInTheDocument();
  });

  it("shows empty state when no improvements", () => {
    render(
      <ReportSection
        improvements={[]}
        keyMessagesDelivered={5}
        keyMessagesTotal={5}
      />,
    );
    expect(
      screen.getByText("No improvement suggestions at this time."),
    ).toBeInTheDocument();
  });

  it("does not show empty state when improvements exist", () => {
    render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    expect(
      screen.queryByText("No improvement suggestions at this time."),
    ).not.toBeInTheDocument();
  });

  it("handles zero total key messages", () => {
    const { container } = render(
      <ReportSection
        improvements={[]}
        keyMessagesDelivered={0}
        keyMessagesTotal={0}
      />,
    );
    expect(screen.getByText("0/0")).toBeInTheDocument();
    // Progress bar width should be 0%
    const progressBar = container.querySelector("[style]");
    expect(progressBar).toHaveStyle({ width: "0%" });
  });

  it("sorts priorities in order: high, medium, low", () => {
    const { container } = render(
      <ReportSection
        improvements={mockImprovements}
        keyMessagesDelivered={3}
        keyMessagesTotal={5}
      />,
    );
    const badges = container.querySelectorAll(".text-xs");
    const badgeTexts = Array.from(badges).map((b) => b.textContent);
    const highIdx = badgeTexts.indexOf("report.highPriority");
    const medIdx = badgeTexts.indexOf("report.mediumPriority");
    const lowIdx = badgeTexts.indexOf("report.lowPriority");
    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });
});
