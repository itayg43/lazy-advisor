import { StatusCodes } from "http-status-codes";

export class BaseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

export class InternalError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

export class ServiceUnavailableError extends BaseError {
  constructor(message: string) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE);
  }
}
