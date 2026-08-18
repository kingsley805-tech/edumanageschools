export type LogEvent = {
  timestamp?: string;
  level: "info" | "warn" | "error" | "debug";
  event: string;
  callSid?: string;
  schoolId?: string;
  callId?: string;
  durationMs?: number;
  error?: string;
  data?: Record<string, unknown>;
};

export const logger = {
  info: (event: string, meta: Omit<LogEvent, "level" | "event"> = {}) => {
    log({ level: "info", event, ...meta });
  },
  warn: (event: string, meta: Omit<LogEvent, "level" | "event"> = {}) => {
    log({ level: "warn", event, ...meta });
  },
  error: (event: string, meta: Omit<LogEvent, "level" | "event"> = {}) => {
    log({ level: "error", event, ...meta });
  },
  debug: (event: string, meta: Omit<LogEvent, "level" | "event"> = {}) => {
    if (process.env.DEBUG === "true") {
      log({ level: "debug", event, ...meta });
    }
  },
};

function log(entry: LogEvent) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const jsonStr = JSON.stringify(payload);
  if (entry.level === "error") {
    console.error(jsonStr);
  } else if (entry.level === "warn") {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}
