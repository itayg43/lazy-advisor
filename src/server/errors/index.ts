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

export class BadGatewayError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_GATEWAY);
    this.name = "BadGatewayError";
  }
}

export class SchemaValidationError extends BadGatewayError {
  readonly cause: ZodError;

  constructor(message: string, cause: ZodError) {
    super(message);
    this.name = "SchemaValidationError";
    this.cause = cause;
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
