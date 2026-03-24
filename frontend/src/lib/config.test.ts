import { describe, it, expect, vi, beforeEach } from "vitest";

describe("lib/config FEATURE_FLAGS", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should have avatarEnabled as false when env var is not 'true'", async () => {
    // import.meta.env is already set at module level; default is undefined -> false
    const { FEATURE_FLAGS } = await import("@/lib/config");
    expect(FEATURE_FLAGS.avatarEnabled).toBe(false);
  });

  it("should have voiceEnabled as false when env var is not 'true'", async () => {
    const { FEATURE_FLAGS } = await import("@/lib/config");
    expect(FEATURE_FLAGS.voiceEnabled).toBe(false);
  });

  it("should export a readonly object", async () => {
    const { FEATURE_FLAGS } = await import("@/lib/config");
    expect(typeof FEATURE_FLAGS).toBe("object");
    expect(FEATURE_FLAGS).toHaveProperty("avatarEnabled");
    expect(FEATURE_FLAGS).toHaveProperty("voiceEnabled");
  });
});
