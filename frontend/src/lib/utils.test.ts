import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("should merge class names", () => {
    const result = cn("foo", "bar");
    expect(result).toBe("foo bar");
  });

  it("should handle conditional class names", () => {
    const result = cn("base", true && "active", false && "hidden");
    expect(result).toBe("base active");
  });

  it("should handle undefined and null values", () => {
    const result = cn("base", undefined, null);
    expect(result).toBe("base");
  });

  it("should handle empty string inputs", () => {
    const result = cn("", "foo", "");
    expect(result).toBe("foo");
  });

  it("should merge tailwind classes with conflict resolution", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toBe("py-1 px-4");
  });

  it("should handle array inputs", () => {
    const result = cn(["foo", "bar"]);
    expect(result).toBe("foo bar");
  });

  it("should handle object inputs", () => {
    const result = cn({ active: true, hidden: false, visible: true });
    expect(result).toBe("active visible");
  });

  it("should return empty string for no inputs", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("should merge tailwind color classes", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("should handle mixed inputs", () => {
    const result = cn("base", ["arr1", "arr2"], { obj: true });
    expect(result).toBe("base arr1 arr2 obj");
  });
});
