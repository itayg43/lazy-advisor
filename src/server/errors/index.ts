import { StatusCodes } from "http-status-codes";
import type { ZodError } from "zod";

export class BaseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BaseError";
    this.status = status;
  }
}

export class InternalError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
    this.name = "InternalError";
  }
}

// Base for schema-validation failures that carry the offending `ZodError`.
// Concrete subclasses fix the HTTP status by origin: BadGateway when an
// upstream response is malformed, Internal when our own code produces a value
// that violates its schema.
export class SchemaValidationError extends BaseError {
  readonly cause: ZodError;

  constructor(message: string, status: number, cause: ZodError) {
    super(message, status);
    this.name = "SchemaValidationError";
    this.cause = cause;
  }
}

export class BadGatewaySchemaValidationError extends SchemaValidationError {
  constructor(message: string, cause: ZodError) {
    super(message, StatusCodes.BAD_GATEWAY, cause);
    this.name = "BadGatewaySchemaValidationError";
  }
}

export class InternalSchemaValidationError extends SchemaValidationError {
  constructor(message: string, cause: ZodError) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, cause);
    this.name = "InternalSchemaValidationError";
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
    this.name = "ServiceUnavailableError";
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
