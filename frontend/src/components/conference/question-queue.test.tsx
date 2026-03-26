import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionQueue } from "./question-queue";
import type { QueuedQuestion } from "@/types/conference";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

vi.mock("./question-item", () => ({
  QuestionItem: ({
    question,
    onRespond,
  }: {
    question: QueuedQuestion;
    onRespond: (id: string) => void;
  }) => (
    <div data-testid="question-item" onClick={() => onRespond(question.hcpProfileId)}>
      {question.hcpName}: {question.question}
    </div>
  ),
}));

function makeQuestion(
  id: string,
  name: string,
  text: string,
): QueuedQuestion {
  return {
    hcpProfileId: id,
    hcpName: name,
    question: text,
    relevanceScore: 0.8,
    status: "waiting",
  };
}

describe("QuestionQueue", () => {
  it("returns null when questions array is empty", () => {
    const { container } = render(
      <QuestionQueue questions={[]} onRespondTo={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the heading with translation key", () => {
    const questions = [makeQuestion("1", "Dr. A", "Question 1")];
    render(<QuestionQueue questions={questions} onRespondTo={vi.fn()} />);
    expect(screen.getByText("questionQueue")).toBeInTheDocument();
  });

  it("renders a region with aria-live polite", () => {
    const questions = [makeQuestion("1", "Dr. A", "Question 1")];
    render(<QuestionQueue questions={questions} onRespondTo={vi.fn()} />);
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders one QuestionItem per question", () => {
    const questions = [
      makeQuestion("1", "Dr. A", "Question 1"),
      makeQuestion("2", "Dr. B", "Question 2"),
      makeQuestion("3", "Dr. C", "Question 3"),
    ];
    render(<QuestionQueue questions={questions} onRespondTo={vi.fn()} />);
    expect(screen.getAllByTestId("question-item")).toHaveLength(3);
  });

  it("passes onRespondTo to QuestionItem", async () => {
    const onRespondTo = vi.fn();
    const questions = [makeQuestion("prof-42", "Dr. A", "Q1")];
    render(<QuestionQueue questions={questions} onRespondTo={onRespondTo} />);
    screen.getByTestId("question-item").click();
    expect(onRespondTo).toHaveBeenCalledWith("prof-42");
  });
});
