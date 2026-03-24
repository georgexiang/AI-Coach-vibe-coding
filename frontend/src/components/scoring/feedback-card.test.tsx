import { render, screen } from "@testing-library/react";
import { FeedbackCard } from "./feedback-card";
import type { ScoreDetail } from "@/types/score";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

describe("FeedbackCard", () => {
  it("renders dimension name and score", () => {
    const detail: ScoreDetail = {
      dimension: "Communication Skills",
      score: 85,
      weight: 20,
      strengths: [],
      weaknesses: [],
      suggestions: [],
    };

    render(<FeedbackCard detail={detail} />);
    expect(screen.getByText("Communication Skills")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("renders strengths section with text and quotes", () => {
    const detail: ScoreDetail = {
      dimension: "Product Knowledge",
      score: 90,
      weight: 25,
      strengths: [
        { text: "Excellent detail", quote: "The data shows..." },
        { text: "Good follow-up", quote: "" },
      ],
      weaknesses: [],
      suggestions: [],
    };

    render(<FeedbackCard detail={detail} />);
    expect(screen.getByText("strengths")).toBeInTheDocument();
    expect(screen.getByText("Excellent detail")).toBeInTheDocument();
  });

  it("renders weaknesses section", () => {
    const detail: ScoreDetail = {
      dimension: "Objection Handling",
      score: 55,
      weight: 20,
      strengths: [],
      weaknesses: [
        { text: "Missed objection", quote: "I'm not sure about..." },
      ],
      suggestions: [],
    };

    render(<FeedbackCard detail={detail} />);
    expect(screen.getByText("areasToImprove")).toBeInTheDocument();
    expect(screen.getByText("Missed objection")).toBeInTheDocument();
  });

  it("renders suggestions section", () => {
    const detail: ScoreDetail = {
      dimension: "Scientific Info",
      score: 70,
      weight: 15,
      strengths: [],
      weaknesses: [],
      suggestions: ["Provide more clinical trial references"],
    };

    render(<FeedbackCard detail={detail} />);
    expect(screen.getByText("suggestions")).toBeInTheDocument();
    expect(
      screen.getByText("Provide more clinical trial references"),
    ).toBeInTheDocument();
  });
});
