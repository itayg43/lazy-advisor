export type LogContext = Record<string, unknown>;

export type Logger = {
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error: unknown, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
};

// .bind(console) preserves `this` context — without it, extracted console
// methods lose their receiver and throw "Illegal invocation" in some runtimes.
// e.g. const fn = console.log; fn("hello") → Illegal invocation
const CONSOLE_METHODS = {
  INFO: console.log.bind(console),
  ERROR: console.error.bind(console),
  WARN: console.warn.bind(console),
  DEBUG: console.debug.bind(console),
} as const;

type LogLevel = keyof typeof CONSOLE_METHODS;

export const createLogger = (tag: string): Logger => ({
  info: (message, context) => {
    log("INFO", tag, message, context);
  },
  warn: (message, context) => {
    log("WARN", tag, message, context);
  },
  error: (message, error, context) => {
    log("ERROR", tag, message, context, error);
  },
  debug: (message, context) => {
    log("DEBUG", tag, message, context);
  },
});

function log(
  level: LogLevel,
  tag: string,
  message: string,
  context?: LogContext,
  error?: unknown,
): void {
  const base = `[${new Date().toISOString()}] [${level}] [${tag}]: ${message}`;

  const args: unknown[] = [];
  if (error !== undefined) {
    args.push(serializeError(error));
  }
  if (context) {
    args.push(JSON.stringify(context, null, 2));
  }

  CONSOLE_METHODS[level](base, ...args);
}

function serializeError(error: unknown): string {
  if (error === null || error === undefined) {
    return "Error value was null or undefined";
  }

  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  if (typeof error === "object") {
    return JSON.stringify(error, null, 2);
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(error);
}
