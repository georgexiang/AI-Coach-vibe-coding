import { render, screen } from "@testing-library/react";
import { adjustWeights, ScoringWeights } from "./scoring-weights";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

// adjustWeights pure function tests
describe("adjustWeights", () => {
  const defaultWeights = {
    key_message: 30,
    objection_handling: 25,
    communication: 20,
    product_knowledge: 15,
    scientific_info: 10,
  };

  it("should always produce weights that sum to 100", () => {
    const result = adjustWeights(defaultWeights, "key_message", 50);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("should set the changed key to the exact new value", () => {
    const result = adjustWeights(defaultWeights, "key_message", 60);
    expect(result.key_message).toBe(60);
  });

  it("should return the same weights when value does not change", () => {
    const result = adjustWeights(defaultWeights, "key_message", 30);
    expect(result).toBe(defaultWeights);
  });

  it("should produce no negative values", () => {
    const result = adjustWeights(defaultWeights, "key_message", 95);
    for (const val of Object.values(result)) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });

  it("should handle all-zero redistribution when others are zero", () => {
    const allZeroOthers = {
      key_message: 100,
      objection_handling: 0,
      communication: 0,
      product_knowledge: 0,
      scientific_info: 0,
    };
    const result = adjustWeights(allZeroOthers, "key_message", 60);
    expect(result.key_message).toBe(60);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    // The remaining 40 should be distributed among the 4 other keys
    const otherSum =
      result.objection_handling +
      result.communication +
      result.product_knowledge +
      result.scientific_info;
    expect(otherSum).toBe(40);
  });

  it("should handle setting a value to 100", () => {
    const result = adjustWeights(defaultWeights, "communication", 100);
    expect(result.communication).toBe(100);
    expect(result.key_message).toBe(0);
    expect(result.objection_handling).toBe(0);
    expect(result.product_knowledge).toBe(0);
    expect(result.scientific_info).toBe(0);
  });

  it("should handle setting a value to 0", () => {
    const result = adjustWeights(defaultWeights, "key_message", 0);
    expect(result.key_message).toBe(0);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

// Component rendering tests
describe("ScoringWeights component", () => {
  it("renders all five weight labels and their values", () => {
    const weights = {
      key_message: 30,
      objection_handling: 25,
      communication: 20,
      product_knowledge: 15,
      scientific_info: 10,
    };
    const onChange = vi.fn();

    render(<ScoringWeights weights={weights} onChange={onChange} />);

    expect(screen.getByText("scenarios.keyMessageDelivery")).toBeInTheDocument();
    expect(screen.getByText("scenarios.objectionHandling")).toBeInTheDocument();
    expect(screen.getByText("scenarios.communicationSkills")).toBeInTheDocument();
    expect(screen.getByText("scenarios.productKnowledge")).toBeInTheDocument();
    expect(screen.getByText("scenarios.scientificInfo")).toBeInTheDocument();

    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("15%")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("Total: 100%")).toBeInTheDocument();
  });
});
