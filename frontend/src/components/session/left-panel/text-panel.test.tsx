import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextPanel } from "./text-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/coach/key-messages", () => ({
  KeyMessages: ({ messages }: { messages: unknown[] }) => (
    <div data-testid="key-messages">{messages.length} messages</div>
  ),
}));

describe("TextPanel", () => {
  const defaultProps = {
    hcpName: "Dr. Zhang",
    hcpSpecialty: "Oncology",
    scenarioDescription: "Discuss treatment options with Dr. Zhang",
    keyMessagesStatus: [
      { message: "Key point 1", delivered: true, detected_at: "2026-01-01T00:00:00Z" },
      { message: "Key point 2", delivered: false, detected_at: null },
    ],
  };

  it("renders HCP name", () => {
    render(<TextPanel {...defaultProps} />);
    expect(screen.getByText("Dr. Zhang")).toBeInTheDocument();
  });

  it("renders HCP specialty", () => {
    render(<TextPanel {...defaultProps} />);
    expect(screen.getByText("Oncology")).toBeInTheDocument();
  });

  it("renders HCP initials avatar", () => {
    render(<TextPanel {...defaultProps} />);
    expect(screen.getByText("DR")).toBeInTheDocument();
  });

  it("renders scenario description", () => {
    render(<TextPanel {...defaultProps} />);
    expect(
      screen.getByText("Discuss treatment options with Dr. Zhang"),
    ).toBeInTheDocument();
  });

  it("renders KeyMessages component with status data", () => {
    render(<TextPanel {...defaultProps} />);
    expect(screen.getByTestId("key-messages")).toBeInTheDocument();
    expect(screen.getByText("2 messages")).toBeInTheDocument();
  });

  it("uses i18n keys for section headers", () => {
    render(<TextPanel {...defaultProps} />);
    expect(screen.getByText("textPanel.scenario")).toBeInTheDocument();
    expect(
      screen.getByText("textPanel.keyMessages"),
    ).toBeInTheDocument();
  });
});
