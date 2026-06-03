import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DryRunScoreSummary } from "./dry-run-score-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (opts?.defaultValue as string) ?? key,
  }),
}));

describe("DryRunScoreSummary", () => {
  it("shows not evaluated instead of zero when score and coverage are null", () => {
    render(
      <DryRunScoreSummary
        score={null}
        coveragePercent={null}
        coveredSteps={0}
        totalSteps={3}
        issuesCount={1}
      />,
    );

    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Not evaluated").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });

  it("still shows real zero scores when evaluation completed with zero", () => {
    render(
      <DryRunScoreSummary
        score={0}
        coveragePercent={0}
        coveredSteps={0}
        totalSteps={3}
        issuesCount={2}
      />,
    );

    expect(screen.getByText("/100")).toBeInTheDocument();
    expect(screen.getByText("0/3")).toBeInTheDocument();
  });
});
