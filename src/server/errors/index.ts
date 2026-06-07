import { StatusCodes } from "http-status-codes";
import type { ZodError } from "zod";

/**
 * Root of the HTTP-mapped error hierarchy: every error that can reach the HTTP
 * boundary carries a `status`. Never thrown directly — pick a concrete subclass
 * by what the failure says about its *cause* (see each subclass below).
 */
export class BaseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BaseError";
    this.status = status;
  }
}

/**
 * 500 — our fault. Use when our own code reached a state it shouldn't: an
 * unexpected post-success branch, missing configuration, or a value we produced
 * that violates an invariant. Not for upstream failures.
 */
export class InternalError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
    this.name = "InternalError";
  }
}

/**
 * 502 — an upstream dependency answered, but the response is invalid or unusable
 * per our contract (malformed, or semantically incomplete such as a model
 * omitting a requested field). Distinct from `ServiceUnavailableError`, which is
 * for an upstream that is *down* or temporarily failing rather than answering
 * badly. When the malformed response is specifically a Zod parse failure, use
 * `BadGatewaySchemaValidationError` so the `ZodError` is carried as the cause.
 */
export class BadGatewayError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_GATEWAY);
    this.name = "BadGatewayError";
  }
}

/**
 * 503 — an upstream dependency is down or temporarily failing: a 5xx, a 429
 * rate-limit, a connection failure, or a non-completed response. Signals the
 * caller may retry. Distinct from `BadGatewayError`, where the upstream answered
 * but with a bad payload.
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Base for schema-validation failures that carry the offending `ZodError`. Never
 * thrown directly — concrete subclasses fix the HTTP status by origin:
 * BadGateway when an upstream response is malformed, Internal when our own code
 * produces a value that violates its schema.
 */
export class SchemaValidationError extends BaseError {
  readonly cause: ZodError;

  constructor(message: string, status: number, cause: ZodError) {
    super(message, status);
    this.name = "SchemaValidationError";
    this.cause = cause;
  }
}

/**
 * 502 — an upstream response failed our Zod schema. The `BadGatewayError` case
 * specialized for parse failures: same "bad upstream response" meaning, but
 * carries the `ZodError` cause for diagnostics.
 */
export class BadGatewaySchemaValidationError extends SchemaValidationError {
  constructor(message: string, cause: ZodError) {
    super(message, StatusCodes.BAD_GATEWAY, cause);
    this.name = "BadGatewaySchemaValidationError";
  }
}

/**
 * 500 — a value our own code produced failed its Zod schema. The `InternalError`
 * case specialized for parse failures: our-fault meaning, plus the `ZodError`
 * cause for diagnostics.
 */
export class InternalSchemaValidationError extends SchemaValidationError {
  constructor(message: string, cause: ZodError) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, cause);
    this.name = "InternalSchemaValidationError";
  }
}

/**
 * Expected, user-driven flow outcomes thrown by pipeline primitives — caught
 * at the phase boundary and translated to in-band results (`unresolved`, or a
 * phase-specific `completed` default). Sibling to `BaseError`: never reaches
 * HTTP, so no `status` code.
 */
export class PipelineControlFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineControlFlowError";
  }
}
