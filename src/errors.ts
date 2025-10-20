export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toPayload(): ErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    } satisfies ErrorPayload;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (code: string, message: string, details?: unknown) =>
  new AppError(401, code, message, details);

export const forbidden = (code: string, message: string, details?: unknown) =>
  new AppError(403, code, message, details);

export const notFound = (code: string, message: string, details?: unknown) =>
  new AppError(404, code, message, details);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);

export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
