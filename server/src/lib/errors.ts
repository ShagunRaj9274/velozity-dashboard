/**
 * Every error that reaches the client has the same shape:
 *   { "error": { "code": "FORBIDDEN", "message": "...", "details"?: [...], "requestId": "..." } }
 * Services throw AppError; the global error handler serialises it.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  /** Used for out-of-scope resources too, so IDs of other teams' data can't be probed. */
  static notFound(resource = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
}
