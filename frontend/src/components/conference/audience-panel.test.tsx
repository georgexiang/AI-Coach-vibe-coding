import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudiencePanel } from "./audience-panel";
import type { AudienceHcp } from "@/types/conference";

function makeHcp(id: string, name: string): AudienceHcp {
  return {
    id,
    scenarioId: "scen-1",
    hcpProfileId: `prof-${id}`,
    hcpName: name,
    hcpSpecialty: "Cardiology",
    roleInConference: "panelist",
    voiceId: "voice-1",
    sortOrder: 1,
    status: "listening",
  };
}

describe("AudiencePanel", () => {
  it("renders a region with audience label", () => {
    render(<AudiencePanel hcps={[]} />);
    expect(screen.getByRole("region", { name: "audience" })).toBeInTheDocument();
  });

  it("renders one AudienceCard per HCP", () => {
    const hcps = [
      makeHcp("1", "Alice Tan"),
      makeHcp("2", "Bob Lee"),
      makeHcp("3", "Carol Wang"),
    ];
    render(<AudiencePanel hcps={hcps} />);
    expect(screen.getByText("Alice Tan")).toBeInTheDocument();
    expect(screen.getByText("Bob Lee")).toBeInTheDocument();
    expect(screen.getByText("Carol Wang")).toBeInTheDocument();
  });

  it("renders no audience cards when list is empty", () => {
    render(<AudiencePanel hcps={[]} />);
    const region = screen.getByRole("region", { name: "audience" });
    expect(region.querySelectorAll("[aria-label]")).toHaveLength(0);
  });
});
