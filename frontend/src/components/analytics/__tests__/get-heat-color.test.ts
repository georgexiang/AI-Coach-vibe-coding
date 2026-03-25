import { describe, it, expect } from "vitest";
import { getHeatColor } from "../skill-gap-heatmap";

describe("getHeatColor", () => {
  describe("green tier (score >= 80)", () => {
    it("returns green classes for score of 80 (boundary)", () => {
      expect(getHeatColor(80)).toBe("bg-green-100 text-green-800");
    });

    it("returns green classes for score of 100", () => {
      expect(getHeatColor(100)).toBe("bg-green-100 text-green-800");
    });

    it("returns green classes for score of 85", () => {
      expect(getHeatColor(85)).toBe("bg-green-100 text-green-800");
    });

    it("returns green classes for score of 95", () => {
      expect(getHeatColor(95)).toBe("bg-green-100 text-green-800");
    });
  });

  describe("yellow tier (70 <= score < 80)", () => {
    it("returns yellow classes for score of 70 (boundary)", () => {
      expect(getHeatColor(70)).toBe("bg-yellow-100 text-yellow-800");
    });

    it("returns yellow classes for score of 79 (upper boundary)", () => {
      expect(getHeatColor(79)).toBe("bg-yellow-100 text-yellow-800");
    });

    it("returns yellow classes for score of 75", () => {
      expect(getHeatColor(75)).toBe("bg-yellow-100 text-yellow-800");
    });
  });

  describe("orange tier (60 <= score < 70)", () => {
    it("returns orange classes for score of 60 (boundary)", () => {
      expect(getHeatColor(60)).toBe("bg-orange-100 text-orange-800");
    });

    it("returns orange classes for score of 69 (upper boundary)", () => {
      expect(getHeatColor(69)).toBe("bg-orange-100 text-orange-800");
    });

    it("returns orange classes for score of 65", () => {
      expect(getHeatColor(65)).toBe("bg-orange-100 text-orange-800");
    });
  });

  describe("red tier (score < 60)", () => {
    it("returns red classes for score of 59 (boundary)", () => {
      expect(getHeatColor(59)).toBe("bg-red-100 text-red-800");
    });

    it("returns red classes for score of 0", () => {
      expect(getHeatColor(0)).toBe("bg-red-100 text-red-800");
    });

    it("returns red classes for score of 50", () => {
      expect(getHeatColor(50)).toBe("bg-red-100 text-red-800");
    });

    it("returns red classes for score of 30", () => {
      expect(getHeatColor(30)).toBe("bg-red-100 text-red-800");
    });
  });

  describe("edge cases", () => {
    it("handles negative scores as red", () => {
      expect(getHeatColor(-1)).toBe("bg-red-100 text-red-800");
      expect(getHeatColor(-100)).toBe("bg-red-100 text-red-800");
    });

    it("handles scores above 100 as green", () => {
      expect(getHeatColor(101)).toBe("bg-green-100 text-green-800");
      expect(getHeatColor(999)).toBe("bg-green-100 text-green-800");
    });

    it("handles decimal boundary values", () => {
      expect(getHeatColor(79.9)).toBe("bg-yellow-100 text-yellow-800");
      expect(getHeatColor(80.0)).toBe("bg-green-100 text-green-800");
      expect(getHeatColor(69.9)).toBe("bg-orange-100 text-orange-800");
      expect(getHeatColor(70.0)).toBe("bg-yellow-100 text-yellow-800");
      expect(getHeatColor(59.9)).toBe("bg-red-100 text-red-800");
      expect(getHeatColor(60.0)).toBe("bg-orange-100 text-orange-800");
    });
  });
});
