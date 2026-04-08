import { describe, it, expect } from "vitest";
import { encodePcmToBase64, resolveMode } from "../voice-utils";

describe("encodePcmToBase64", () => {
  it("encodes empty Float32Array to empty string", () => {
    const result = encodePcmToBase64(new Float32Array(0));
    expect(result).toBe("");
  });

  it("encodes silence (zeros) to correct byte length", () => {
    const silence = new Float32Array(4).fill(0);
    const result = encodePcmToBase64(silence);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Decode and verify: 4 samples * 2 bytes each = 8 bytes
    const decoded = atob(result);
    expect(decoded.length).toBe(8);
  });

  it("clips values above 1.0", () => {
    const loud = new Float32Array([1.5, 2.0, 100.0]);
    const clipped = new Float32Array([1.0, 1.0, 1.0]);
    expect(encodePcmToBase64(loud)).toBe(encodePcmToBase64(clipped));
  });

  it("clips values below -1.0", () => {
    const loud = new Float32Array([-1.5, -2.0, -100.0]);
    const clipped = new Float32Array([-1.0, -1.0, -1.0]);
    expect(encodePcmToBase64(loud)).toBe(encodePcmToBase64(clipped));
  });

  it("handles NaN values safely", () => {
    const bad = new Float32Array(3);
    bad[0] = NaN;
    expect(() => encodePcmToBase64(bad)).not.toThrow();
  });

  it("produces valid base64 output", () => {
    const audio = new Float32Array([0.5, -0.5, 0.0, 1.0, -1.0]);
    const result = encodePcmToBase64(audio);
    expect(() => atob(result)).not.toThrow();
  });

  it("encodes max positive value to 0x7FFF", () => {
    const maxPositive = new Float32Array([1.0]);
    const result = encodePcmToBase64(maxPositive);
    const decoded = atob(result);
    const byte0 = decoded.charCodeAt(0);
    const byte1 = decoded.charCodeAt(1);
    // Int16 0x7FFF = 32767 in little-endian: FF 7F
    expect(byte0).toBe(0xff);
    expect(byte1).toBe(0x7f);
  });

  it("encodes max negative value to 0x8000", () => {
    const maxNegative = new Float32Array([-1.0]);
    const result = encodePcmToBase64(maxNegative);
    const decoded = atob(result);
    const byte0 = decoded.charCodeAt(0);
    const byte1 = decoded.charCodeAt(1);
    // Int16 0x8000 = -32768 in little-endian: 00 80
    expect(byte0).toBe(0x00);
    expect(byte1).toBe(0x80);
  });
});

describe("resolveMode", () => {
  const base = {
    endpoint: "https://example.com",
    token: "t",
    region: "eastus",
    model: "gpt-4o",
    avatar_character: "lori",
    voice_name: "en-US-AvaNeural",
    avatar_enabled: false,
  };

  it("returns digital_human_realtime_agent when avatar_enabled and agent_id", () => {
    expect(
      resolveMode({ ...base, avatar_enabled: true, agent_id: "agent-1" }),
    ).toBe("digital_human_realtime_agent");
  });

  it("returns digital_human_realtime_model when avatar_enabled only", () => {
    expect(resolveMode({ ...base, avatar_enabled: true })).toBe(
      "digital_human_realtime_model",
    );
  });

  it("returns voice_realtime_agent when agent_id only (no avatar)", () => {
    expect(
      resolveMode({ ...base, avatar_enabled: false, agent_id: "agent-1" }),
    ).toBe("voice_realtime_agent");
  });

  it("returns voice_realtime_model when neither avatar nor agent", () => {
    expect(resolveMode({ ...base, avatar_enabled: false })).toBe(
      "voice_realtime_model",
    );
  });

  it("returns voice_realtime_model when agent_id is undefined and avatar disabled", () => {
    expect(resolveMode({ ...base, avatar_enabled: false, agent_id: undefined })).toBe(
      "voice_realtime_model",
    );
  });
});
