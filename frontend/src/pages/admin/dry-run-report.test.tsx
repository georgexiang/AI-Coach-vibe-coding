import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DryRunReportPage from "./dry-run-report";
import type { DryRun } from "@/types/dry-run";

const mockDryRun: DryRun = {
  id: "run-1",
  skill_id: "skill-1",
  run_number: 1,
  status: "failed",
  executability_score: null,
  coverage_percent: null,
  total_sop_steps: 3,
  covered_sop_steps: 0,
  partial_sop_steps: 0,
  issues_count: 0,
  duration_seconds: null,
  sop_coverage: [],
  issues: [],
  error_message: "AI service became unavailable during simulation",
  messages: [],
  created_by: "admin",
  created_at: "2026-06-03T01:21:43.120479",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (opts?.defaultValue as string) ?? key,
  }),
}));

vi.mock("@/hooks/use-dry-runs", () => ({
  useDryRun: () => ({
    data: mockDryRun,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateDryRun: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderReport() {
  render(
    <MemoryRouter initialEntries={["/admin/skills/skill-1/dry-run/run-1"]}>
      <Routes>
        <Route
          path="/admin/skills/:id/dry-run/:runId"
          element={<DryRunReportPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DryRunReportPage", () => {
  it("shows failed dry run error instead of no-issues success text", () => {
    renderReport();

    expect(screen.getByText("Dry Run failed")).toBeInTheDocument();
    expect(
      screen.getByText("AI service became unavailable during simulation"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Not evaluated").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("dryRun.noIssues")).not.toBeInTheDocument();
  });
});
