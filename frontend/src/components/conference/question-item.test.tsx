import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionItem } from "./question-item";
import type { QueuedQuestion } from "@/types/conference";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

function makeQuestion(overrides: Partial<QueuedQuestion> = {}): QueuedQuestion {
  return {
    hcpProfileId: "prof-1",
    hcpName: "Dr. Zhang",
    question: "What about side effects?",
    relevanceScore: 0.9,
    status: "waiting",
    ...overrides,
  };
}

describe("QuestionItem", () => {
  const defaultProps = {
    question: makeQuestion(),
    onRespond: vi.fn(),
  };

  it("renders HCP name and question text", () => {
    render(<QuestionItem {...defaultProps} />);
    expect(screen.getByText("Dr. Zhang")).toBeInTheDocument();
    expect(screen.getByText("What about side effects?")).toBeInTheDocument();
  });

  it("renders initials from HCP name", () => {
    render(<QuestionItem {...defaultProps} />);
    expect(screen.getByText("DZ")).toBeInTheDocument();
  });

  it("renders respond button with translation key", () => {
    render(<QuestionItem {...defaultProps} />);
    expect(screen.getByRole("button", { name: "respond" })).toBeInTheDocument();
  });

  it("calls onRespond with hcpProfileId when button is clicked", async () => {
    const onRespond = vi.fn();
    render(
      <QuestionItem
        question={makeQuestion({ status: "waiting" })}
        onRespond={onRespond}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "respond" }));
    expect(onRespond).toHaveBeenCalledWith("prof-1");
  });

  it("disables button when status is active", () => {
    render(
      <QuestionItem
        question={makeQuestion({ status: "active" })}
        onRespond={vi.fn()}
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("disables button when status is answered", () => {
    render(
      <QuestionItem
        question={makeQuestion({ status: "answered" })}
        onRespond={vi.fn()}
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("shows ellipsis text when status is active", () => {
    render(
      <QuestionItem
        question={makeQuestion({ status: "active" })}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("respond...");
  });

  it("applies line-through to question text when answered", () => {
    const { container } = render(
      <QuestionItem
        question={makeQuestion({ status: "answered" })}
        onRespond={vi.fn()}
      />,
    );
    const questionSpan = container.querySelector(".line-through");
    expect(questionSpan).toBeInTheDocument();
  });

  it("applies active styling when status is active", () => {
    const { container } = render(
      <QuestionItem
        question={makeQuestion({ status: "active" })}
        onRespond={vi.fn()}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("border-primary");
  });

  it("applies opacity when status is answered", () => {
    const { container } = render(
      <QuestionItem
        question={makeQuestion({ status: "answered" })}
        onRespond={vi.fn()}
      />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("opacity-50");
  });
});
