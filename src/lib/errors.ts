/**
 * Domain error with an HTTP status + stable machine code. Route handlers map
 * these to safe JSON responses (no stack traces leak to clients).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: (msg = "Authentication required") => new AppError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "You do not have access to this resource") =>
    new AppError(403, "FORBIDDEN", msg),
  notFound: (msg = "Resource not found") => new AppError(404, "NOT_FOUND", msg),
  validation: (msg = "Invalid request", details?: unknown) =>
    new AppError(422, "VALIDATION_ERROR", msg, details),
  conflict: (msg = "Conflict") => new AppError(409, "CONFLICT", msg),
  insufficientFunds: (msg = "Insufficient available balance") =>
    new AppError(402, "INSUFFICIENT_FUNDS", msg),
  limitExceeded: (msg = "Limit exceeded") => new AppError(422, "LIMIT_EXCEEDED", msg),
  blocked: (msg = "Action not allowed for this account state") =>
    new AppError(403, "BLOCKED", msg),
  rateLimited: (msg = "Too many requests") => new AppError(429, "RATE_LIMITED", msg),
  kycRequired: (msg = "Identity verification required") => new AppError(403, "KYC_REQUIRED", msg),
  internal: (msg = "Internal error") => new AppError(500, "INTERNAL", msg),
};
