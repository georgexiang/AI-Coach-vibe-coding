import { render, screen } from "@testing-library/react";
import { PersonalitySliders } from "./personality-sliders";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

describe("PersonalitySliders", () => {
  const defaultProps = {
    personalityType: "friendly" as const,
    emotionalState: 40,
    communicationStyle: 60,
    onPersonalityTypeChange: vi.fn(),
    onEmotionalStateChange: vi.fn(),
    onCommunicationStyleChange: vi.fn(),
  };

  it("renders the personality section title", () => {
    render(<PersonalitySliders {...defaultProps} />);
    expect(screen.getByText("hcp.personality")).toBeInTheDocument();
  });

  it("renders emotional state and communication style labels", () => {
    render(<PersonalitySliders {...defaultProps} />);
    expect(screen.getByText("hcp.emotionalState")).toBeInTheDocument();
    expect(screen.getByText("hcp.communicationStyle")).toBeInTheDocument();
  });

  it("displays the numeric values for sliders", () => {
    render(<PersonalitySliders {...defaultProps} />);
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
  });

  it("renders scale endpoint labels for both sliders", () => {
    render(<PersonalitySliders {...defaultProps} />);
    expect(screen.getByText("Calm/Neutral")).toBeInTheDocument();
    expect(screen.getByText("Resistant/Hostile")).toBeInTheDocument();
    expect(screen.getByText("Very Direct")).toBeInTheDocument();
    expect(screen.getByText("Very Indirect")).toBeInTheDocument();
  });
});
