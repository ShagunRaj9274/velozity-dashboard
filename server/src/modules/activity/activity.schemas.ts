import { z } from 'zod';

export const ListActivityQuery = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  taskId: z.coerce.number().int().positive().optional(),
  /** Opaque keyset cursor returned as `nextCursor` by the previous page. */
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListActivityQuery = z.infer<typeof ListActivityQuery>;
