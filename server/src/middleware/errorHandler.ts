import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorBody = {
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}`, requestId: req.requestId },
  };
  res.status(404).json(body);
};

/**
 * Single place where errors become HTTP responses. Stack traces are logged
 * server-side and never serialised to the client.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const send = (status: number, code: string, message: string, details?: unknown) => {
    const body: ErrorBody = { error: { code, message, requestId: req.requestId } };
    if (details !== undefined) body.error.details = details;
    res.status(status).json(body);
  };

  if (err instanceof ZodError) {
    send(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      err.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })),
    );
    return;
  }

  if (err instanceof AppError) {
    send(err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return send(409, 'CONFLICT', 'A record with these values already exists');
    if (err.code === 'P2025') return send(404, 'NOT_FOUND', 'Resource not found');
    if (err.code === 'P2003') return send(400, 'INVALID_REFERENCE', 'A referenced record does not exist');
  }

  // body-parser JSON syntax errors
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    send(400, 'INVALID_JSON', 'Request body is not valid JSON');
    return;
  }

  logger.error('Unhandled error', {
    requestId: req.requestId,
    path: req.path,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  send(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
};
