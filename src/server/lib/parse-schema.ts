import type { ZodError, ZodType } from "zod";

import type { SchemaValidationError } from "#errors";

/**
 * Parse `value` against `schema`, returning the typed data or throwing the
 * `SchemaValidationError` the caller builds from the `ZodError` and the
 * offending `value`. The thrower is a factory rather than a baked-in class so
 * each call site picks the right origin-specific subclass (`InternalError`
 * flavor for our own values, `BadGateway` flavor for upstream responses) and
 * supplies its own message.
 */
export const parseSchema = <T>(
  schema: ZodType<T>,
  value: unknown,
  onInvalid: (error: ZodError, value: unknown) => SchemaValidationError,
): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw onInvalid(parsed.error, value);

  return parsed.data;
};
