import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  createVoiceLogger,
  setSessionCorrelationId,
  getSessionCorrelationId,
  getEventSummary,
  resetEventSummary,
  refreshLogLevel,
} from "./voice-logger";

// Provide a functional localStorage mock for this test file.
// jsdom's localStorage may not work reliably in all vitest setups.
const store: Record<string, string> = {};
const storageMock: Storage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k];
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
};

// Save original and stub for this file only
const originalLocalStorage = globalThis.localStorage;
vi.stubGlobal("localStorage", storageMock);

afterAll(() => {
  // Restore original localStorage so other test files are unaffected
  vi.stubGlobal("localStorage", originalLocalStorage);
});

describe("voice-logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetEventSummary();
    storageMock.clear();
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
    storageMock.setItem("VOICE_LOG_LEVEL", "debug");
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
    storageMock.setItem("VOICE_LOG_LEVEL", "debug");
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
