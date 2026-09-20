import type { ZodTypeAny, z } from 'zod';

/**
 * Parse untrusted input with a zod schema. A ZodError propagates to the global
 * error handler and becomes a 400 VALIDATION_ERROR with per-field details.
 */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  return schema.parse(input);
}
