import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createVoiceLogger,
  setSessionCorrelationId,
  getSessionCorrelationId,
  getEventSummary,
  resetEventSummary,
  refreshLogLevel,
} from "./voice-logger";

describe("voice-logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetEventSummary();
    localStorage.removeItem("VOICE_LOG_LEVEL");
    refreshLogLevel();
  });

  it("formats output with [VL:{sid}][Component] prefix", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    setSessionCorrelationId("test1234");
    const log = createVoiceLogger("TestComp");
    log.info("hello %s", "world");
    expect(spy).toHaveBeenCalledWith(
      "[VL:test1234][TestComp]",
      "hello %s",
      "world",
    );
  });

  it("setSessionCorrelationId / getSessionCorrelationId round-trip", () => {
    setSessionCorrelationId("abc");
    expect(getSessionCorrelationId()).toBe("abc");
  });

  it("counts events via log.event() and getEventSummary()", () => {
    const log = createVoiceLogger("Counter");
    log.event("response.audio.delta");
    log.event("response.audio.delta");
    log.event("response.done");
    expect(getEventSummary()).toEqual({
      "response.audio.delta": 2,
      "response.done": 1,
    });
  });

  it("resetEventSummary clears all counts", () => {
    const log = createVoiceLogger("Counter");
    log.event("response.audio.delta");
    resetEventSummary();
    expect(getEventSummary()).toEqual({});
  });

  it("suppresses debug messages at info level (default)", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const log = createVoiceLogger("Level");
    log.debug("should not appear");
    expect(spy).not.toHaveBeenCalled();
  });

  it("emits debug messages when level set to debug", () => {
    localStorage.setItem("VOICE_LOG_LEVEL", "debug");
    refreshLogLevel();
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const log = createVoiceLogger("Level");
    log.debug("should appear");
    expect(spy).toHaveBeenCalled();
  });

  it("always emits warn and error at info level", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createVoiceLogger("Level");
    log.warn("warning");
    log.error("error");
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("delegates to correct console methods", () => {
    localStorage.setItem("VOICE_LOG_LEVEL", "debug");
    refreshLogLevel();
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createVoiceLogger("Delegate");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("getEventSummary returns a copy (not a reference)", () => {
    const log = createVoiceLogger("Copy");
    log.event("a");
    const summary = getEventSummary();
    log.event("a");
    expect(summary).toEqual({ a: 1 });
    expect(getEventSummary()).toEqual({ a: 2 });
  });
});
