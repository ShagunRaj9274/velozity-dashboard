import { z } from 'zod';

export const CreateProjectBody = z
  .object({
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().max(5000).nullable().optional(),
    clientId: z.number().int().positive(),
    /** Admin only: create the project on behalf of a PM. */
    ownerId: z.number().int().positive().optional(),
  })
  .strict();
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

export const UpdateProjectBody = z
  .object({
    name: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    clientId: z.number().int().positive().optional(),
    /** Admin only: transfer ownership to another PM. */
    ownerId: z.number().int().positive().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });
export type UpdateProjectBody = z.infer<typeof UpdateProjectBody>;
