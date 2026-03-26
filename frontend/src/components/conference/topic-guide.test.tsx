import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopicGuide } from "./topic-guide";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: "en" },
  }),
}));

describe("TopicGuide", () => {
  const topics = [
    { message: "Topic A", delivered: false },
    { message: "Topic B", delivered: true },
    { message: "Topic C", delivered: false },
  ];

  const defaultProps = {
    topics,
    scenarioName: "Oncology Conference",
    isCollapsed: false,
    onToggle: vi.fn(),
  };

  describe("when expanded", () => {
    it("renders the heading with translation key", () => {
      render(<TopicGuide {...defaultProps} />);
      // topicGuide appears as heading and as section title
      const headings = screen.getAllByText("topicGuide");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it("renders the scenario name", () => {
      render(<TopicGuide {...defaultProps} />);
      expect(screen.getByText("Oncology Conference")).toBeInTheDocument();
    });

    it("renders all topic items", () => {
      render(<TopicGuide {...defaultProps} />);
      expect(screen.getByText("Topic A")).toBeInTheDocument();
      expect(screen.getByText("Topic B")).toBeInTheDocument();
      expect(screen.getByText("Topic C")).toBeInTheDocument();
    });

    it("applies line-through to delivered topics", () => {
      render(<TopicGuide {...defaultProps} />);
      const deliveredTopic = screen.getByText("Topic B");
      expect(deliveredTopic.className).toContain("line-through");
    });

    it("does not apply line-through to undelivered topics", () => {
      render(<TopicGuide {...defaultProps} />);
      const undeliveredTopic = screen.getByText("Topic A");
      expect(undeliveredTopic.className).not.toContain("line-through");
    });

    it("renders collapse button with aria-label", () => {
      render(<TopicGuide {...defaultProps} />);
      expect(
        screen.getByLabelText("ariaCollapseTopics"),
      ).toBeInTheDocument();
    });

    it("calls onToggle when collapse button is clicked", async () => {
      const onToggle = vi.fn();
      render(<TopicGuide {...defaultProps} onToggle={onToggle} />);
      await userEvent.click(screen.getByLabelText("ariaCollapseTopics"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("renders checkboxes as disabled", () => {
      render(<TopicGuide {...defaultProps} />);
      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((cb) => expect(cb).toBeDisabled());
    });
  });

  describe("when collapsed", () => {
    it("renders expand button with aria-label", () => {
      render(<TopicGuide {...defaultProps} isCollapsed={true} />);
      expect(
        screen.getByLabelText("ariaExpandTopics"),
      ).toBeInTheDocument();
    });

    it("does not render topic items", () => {
      render(<TopicGuide {...defaultProps} isCollapsed={true} />);
      expect(screen.queryByText("Topic A")).not.toBeInTheDocument();
      expect(screen.queryByText("Oncology Conference")).not.toBeInTheDocument();
    });

    it("calls onToggle when expand button is clicked", async () => {
      const onToggle = vi.fn();
      render(<TopicGuide {...defaultProps} isCollapsed={true} onToggle={onToggle} />);
      await userEvent.click(screen.getByLabelText("ariaExpandTopics"));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
