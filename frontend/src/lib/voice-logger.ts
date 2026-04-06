/**
 * Structured Voice Live logger with session correlation, event counting,
 * and runtime log-level control.
 *
 * Usage:
 *   import { createVoiceLogger, setSessionCorrelationId } from "@/lib/voice-logger";
 *   const log = createVoiceLogger("AvatarStream");
 *   log.info("connectionState: %s", pc.connectionState);
 *
 * Output format:  [VL:a3f8c2e1][AvatarStream] connectionState: connected
 *
 * Enable debug logs at runtime (no code change):
 *   localStorage.setItem("VOICE_LOG_LEVEL", "debug")
 */

/* ---------- log levels ---------- */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;

function resolveLevel(): LogLevel {
  try {
    const stored = localStorage.getItem("VOICE_LOG_LEVEL");
    if (stored && stored in LEVELS) return stored as LogLevel;
  } catch {
    /* SSR / restricted storage — fall through */
  }
  return "info";
}

let currentLevel: LogLevel = resolveLevel();

/** Re-read level from localStorage (useful after user changes it). */
export function refreshLogLevel(): void {
  currentLevel = resolveLevel();
}

/* ---------- session correlation ---------- */

let sessionId: string = crypto.randomUUID().slice(0, 8);

export function setSessionCorrelationId(id: string): void {
  sessionId = id;
}

export function getSessionCorrelationId(): string {
  return sessionId;
}

/* ---------- event counting ---------- */

let eventCounts: Record<string, number> = {};

export function getEventSummary(): Record<string, number> {
  return { ...eventCounts };
}

export function resetEventSummary(): void {
  eventCounts = {};
}

/* ---------- logger factory ---------- */

export interface VoiceLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  /** Increment event counter (no console output). For high-frequency events. */
  event: (eventType: string) => void;
}

export function createVoiceLogger(component: string): VoiceLogger {
  const prefix = () => `[VL:${sessionId}][${component}]`;

  const shouldLog = (level: LogLevel): boolean =>
    LEVELS[level] >= LEVELS[currentLevel];

  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog("debug")) {
        // eslint-disable-next-line no-console
        console.debug(prefix(), message, ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      if (shouldLog("info")) {
        // eslint-disable-next-line no-console
        console.info(prefix(), message, ...args);
      }
    },
    warn(message: string, ...args: unknown[]) {
      if (shouldLog("warn")) {
        // eslint-disable-next-line no-console
        console.warn(prefix(), message, ...args);
      }
    },
    error(message: string, ...args: unknown[]) {
      if (shouldLog("error")) {
        // eslint-disable-next-line no-console
        console.error(prefix(), message, ...args);
      }
    },
    event(eventType: string) {
      eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1;
    },
  };
}
