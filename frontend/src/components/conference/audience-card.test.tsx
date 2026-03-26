import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudienceCard } from "./audience-card";
import type { AudienceHcp } from "@/types/conference";

function makeHcp(overrides: Partial<AudienceHcp> = {}): AudienceHcp {
  return {
    id: "hcp-1",
    scenarioId: "scen-1",
    hcpProfileId: "prof-1",
    hcpName: "John Smith",
    hcpSpecialty: "Oncology",
    roleInConference: "panelist",
    voiceId: "voice-1",
    sortOrder: 1,
    status: "listening",
    ...overrides,
  };
}

describe("AudienceCard", () => {
  it("renders HCP name and specialty", () => {
    render(<AudienceCard hcp={makeHcp()} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Oncology")).toBeInTheDocument();
  });

  it("displays initials from HCP name", () => {
    render(<AudienceCard hcp={makeHcp({ hcpName: "Alice Berger" })} />);
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("limits initials to two characters", () => {
    render(<AudienceCard hcp={makeHcp({ hcpName: "John Michael Smith" })} />);
    expect(screen.getByText("JM")).toBeInTheDocument();
  });

  it("sets aria-label with name and status", () => {
    render(<AudienceCard hcp={makeHcp({ hcpName: "Dr Wang", status: "speaking" })} />);
    expect(screen.getByLabelText("Dr Wang - speaking")).toBeInTheDocument();
  });

  it("applies border-primary class when status is speaking", () => {
    render(<AudienceCard hcp={makeHcp({ status: "speaking" })} />);
    const card = screen.getByLabelText("John Smith - speaking");
    expect(card.className).toContain("border-primary");
  });

  it("applies opacity class when status is idle", () => {
    render(<AudienceCard hcp={makeHcp({ status: "idle" })} />);
    const card = screen.getByLabelText("John Smith - idle");
    expect(card.className).toContain("opacity-60");
  });

  it("does not apply border-primary or opacity-60 when status is listening", () => {
    render(<AudienceCard hcp={makeHcp({ status: "listening" })} />);
    const card = screen.getByLabelText("John Smith - listening");
    expect(card.className).not.toContain("border-primary");
    expect(card.className).not.toContain("opacity-60");
  });
});
