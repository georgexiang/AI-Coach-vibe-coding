import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ConferenceAudienceConfig,
  MIN_AUDIENCE,
  MAX_AUDIENCE,
} from "./conference-audience-config";
import type { HcpProfile } from "@/types/hcp";
import type { AudienceHcpCreate } from "@/types/conference";

const profiles = [
  { id: "hcp-1", name: "Dr. Smith" },
  { id: "hcp-2", name: "Dr. Chen" },
  { id: "hcp-3", name: "Dr. Lee" },
] as HcpProfile[];

const labels = {
  title: "Conference Audience",
  description: "Bind multiple HCPs",
  selectHcp: "Select HCP",
  role: "Role",
  roleAudience: "Audience",
  roleModerator: "Moderator",
  addHcp: "Add HCP",
  removeHcp: "Remove HCP",
  moveUp: "Move up",
  moveDown: "Move down",
  primarySpeaker: "Primary",
  secondarySpeaker: "Secondary",
  countHint: "{{count}} bound (need {{min}}-{{max}})",
  minHint: "Need at least {{min}} HCPs",
  duplicateHint: "Duplicate HCP found",
};

function renderConfig(value: AudienceHcpCreate[], onChange = vi.fn()) {
  render(
    <ConferenceAudienceConfig
      value={value}
      onChange={onChange}
      profiles={profiles}
      labels={labels}
    />,
  );
  return onChange;
}

describe("ConferenceAudienceConfig", () => {
  it("renders title and description", () => {
    renderConfig([]);
    expect(screen.getByText("Conference Audience")).toBeInTheDocument();
    expect(screen.getByText("Bind multiple HCPs")).toBeInTheDocument();
  });

  it("renders one row per audience member", () => {
    renderConfig([
      { hcpProfileId: "hcp-1" },
      { hcpProfileId: "hcp-2" },
    ]);
    expect(screen.getAllByLabelText("Select HCP")).toHaveLength(2);
    expect(screen.getAllByLabelText("Remove HCP")).toHaveLength(2);
  });

  it("moves members and reindexes sortOrder", () => {
    const onChange = renderConfig([
      { hcpProfileId: "hcp-1", sortOrder: 0 },
      { hcpProfileId: "hcp-2", sortOrder: 1 },
    ]);
    fireEvent.click(screen.getAllByLabelText("Move up")[1]!);
    expect(onChange).toHaveBeenCalledWith([
      { hcpProfileId: "hcp-2", sortOrder: 0 },
      { hcpProfileId: "hcp-1", sortOrder: 1 },
    ]);
  });

  it("adds a new empty member when Add HCP clicked", () => {
    const onChange = renderConfig([{ hcpProfileId: "hcp-1" }]);
    fireEvent.click(screen.getByText("Add HCP"));
    expect(onChange).toHaveBeenCalledWith([
      { hcpProfileId: "hcp-1" },
      { hcpProfileId: "", roleInConference: "audience", sortOrder: 1 },
    ]);
  });

  it("removes a member and reindexes sortOrder", () => {
    const onChange = renderConfig([
      { hcpProfileId: "hcp-1", sortOrder: 0 },
      { hcpProfileId: "hcp-2", sortOrder: 1 },
    ]);
    fireEvent.click(screen.getAllByLabelText("Remove HCP")[0]!);
    expect(onChange).toHaveBeenCalledWith([
      { hcpProfileId: "hcp-2", sortOrder: 0 },
    ]);
  });

  it("disables Add HCP at max capacity", () => {
    const full = Array.from({ length: MAX_AUDIENCE }, (_, i) => ({
      hcpProfileId: `hcp-${i}`,
    }));
    renderConfig(full);
    expect(screen.getByText("Add HCP").closest("button")).toBeDisabled();
  });

  it("shows count hint with current count", () => {
    renderConfig([{ hcpProfileId: "hcp-1" }, { hcpProfileId: "hcp-2" }]);
    expect(
      screen.getByText(`2 bound (need ${MIN_AUDIENCE}-${MAX_AUDIENCE})`),
    ).toBeInTheDocument();
  });

  it("shows min hint when below minimum", () => {
    renderConfig([{ hcpProfileId: "hcp-1" }]);
    expect(
      screen.getByText(`Need at least ${MIN_AUDIENCE} HCPs`),
    ).toBeInTheDocument();
  });

  it("hides min hint when at minimum", () => {
    renderConfig([{ hcpProfileId: "hcp-1" }, { hcpProfileId: "hcp-2" }]);
    expect(
      screen.queryByText(`Need at least ${MIN_AUDIENCE} HCPs`),
    ).not.toBeInTheDocument();
  });

  it("shows duplicate hint when HCPs repeat", () => {
    renderConfig([{ hcpProfileId: "hcp-1" }, { hcpProfileId: "hcp-1" }]);
    expect(screen.getByText("Duplicate HCP found")).toBeInTheDocument();
  });

  it("does not show duplicate hint for unique HCPs", () => {
    renderConfig([{ hcpProfileId: "hcp-1" }, { hcpProfileId: "hcp-2" }]);
    expect(screen.queryByText("Duplicate HCP found")).not.toBeInTheDocument();
  });
});
