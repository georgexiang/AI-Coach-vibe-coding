import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionItem } from "./session-item";

describe("SessionItem", () => {
  const defaultProps = {
    hcpName: "Dr. Smith",
    specialty: "Oncology",
    mode: "F2F" as const,
    score: 85,
    timeAgo: "2h ago",
  };

  it("renders HCP name and specialty", () => {
    render(<SessionItem {...defaultProps} />);
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Oncology")).toBeInTheDocument();
  });

  it("renders mode badge", () => {
    render(<SessionItem {...defaultProps} />);
    expect(screen.getByText("modeF2F")).toBeInTheDocument();
  });

  it("renders score and time ago", () => {
    render(<SessionItem {...defaultProps} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("renders initials in avatar fallback", () => {
    render(<SessionItem {...defaultProps} />);
    expect(screen.getByText("DS")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<SessionItem {...defaultProps} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
