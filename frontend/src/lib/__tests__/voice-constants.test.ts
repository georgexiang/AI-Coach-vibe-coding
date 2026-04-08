import { describe, it, expect } from "vitest";
import {
  VOICE_NAME_OPTIONS,
  TURN_DETECTION_TYPES,
  RECOGNITION_LANGUAGES,
  CDN_BASE,
  createDefaultVlInstanceForm,
} from "../voice-constants";

describe("voice-constants", () => {
  it("VOICE_NAME_OPTIONS has entries with value and labelKey", () => {
    expect(VOICE_NAME_OPTIONS.length).toBeGreaterThan(0);
    for (const opt of VOICE_NAME_OPTIONS) {
      expect(opt.value).toBeTruthy();
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("VOICE_NAME_OPTIONS contains expected English and Chinese voices", () => {
    const values = VOICE_NAME_OPTIONS.map((o) => o.value);
    expect(values).toContain("en-US-AvaNeural");
    expect(values).toContain("zh-CN-XiaoxiaoNeural");
  });

  it("TURN_DETECTION_TYPES has entries with value and labelKey", () => {
    expect(TURN_DETECTION_TYPES.length).toBeGreaterThan(0);
    for (const opt of TURN_DETECTION_TYPES) {
      expect(opt.value).toBeTruthy();
      expect(opt.labelKey).toBeTruthy();
    }
  });

  it("TURN_DETECTION_TYPES includes server_vad and semantic_vad", () => {
    const values = TURN_DETECTION_TYPES.map((t) => t.value);
    expect(values).toContain("server_vad");
    expect(values).toContain("semantic_vad");
  });

  it("RECOGNITION_LANGUAGES includes auto and common languages", () => {
    const values = RECOGNITION_LANGUAGES.map((l) => l.value);
    expect(values).toContain("auto");
    expect(values).toContain("zh-CN");
    expect(values).toContain("en-US");
  });

  it("RECOGNITION_LANGUAGES has entries with value and labelKey", () => {
    expect(RECOGNITION_LANGUAGES.length).toBeGreaterThan(0);
    for (const lang of RECOGNITION_LANGUAGES) {
      expect(lang.value).toBeTruthy();
      expect(lang.labelKey).toBeTruthy();
    }
  });

  it("CDN_BASE is a valid Azure URL string", () => {
    expect(CDN_BASE).toContain("https://");
    expect(CDN_BASE).toContain("azure");
  });
});

describe("createDefaultVlInstanceForm", () => {
  it("returns a fresh object each call", () => {
    const a = createDefaultVlInstanceForm();
    const b = createDefaultVlInstanceForm();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("returns expected default values", () => {
    const form = createDefaultVlInstanceForm();
    expect(form.name).toBe("");
    expect(form.voice_live_model).toBe("gpt-4o");
    expect(form.enabled).toBe(true);
    expect(form.voice_name).toBe("en-US-AvaNeural");
    expect(form.avatar_character).toBe("lori");
    expect(form.turn_detection_type).toBe("server_vad");
    expect(form.recognition_language).toBe("auto");
  });

  it("returns expected numeric defaults", () => {
    const form = createDefaultVlInstanceForm();
    expect(form.voice_temperature).toBe(0.9);
    expect(form.response_temperature).toBe(0.8);
    expect(form.playback_speed).toBe(1.0);
  });

  it("returns expected boolean defaults", () => {
    const form = createDefaultVlInstanceForm();
    expect(form.avatar_enabled).toBe(true);
    expect(form.proactive_engagement).toBe(true);
    expect(form.auto_detect_language).toBe(true);
    expect(form.noise_suppression).toBe(false);
    expect(form.echo_cancellation).toBe(false);
    expect(form.eou_detection).toBe(false);
    expect(form.voice_custom).toBe(false);
    expect(form.avatar_customized).toBe(false);
    expect(form.custom_lexicon_enabled).toBe(false);
  });

  it("mutation of one instance does not affect another", () => {
    const a = createDefaultVlInstanceForm();
    a.name = "mutated";
    const b = createDefaultVlInstanceForm();
    expect(b.name).toBe("");
  });
});
