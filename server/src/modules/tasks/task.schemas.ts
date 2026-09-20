import { Priority, TaskStatus } from '@prisma/client';
import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

/** Accepts `?status=TODO,IN_REVIEW` or repeated `?status=TODO&status=DONE` (shareable URLs). */
const csvOf = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return undefined;
    const arr = Array.isArray(v) ? v : [v];
    return arr.flatMap((x) => String(x).split(',')).map((s) => s.trim()).filter(Boolean);
  }, z.array(item).max(10).optional());

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
const optionalId = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional());

export const ListTasksQuery = z
  .object({
    status: csvOf(z.nativeEnum(TaskStatus)),
    priority: csvOf(z.nativeEnum(Priority)),
    dueFrom: optionalDate,
    dueTo: optionalDate,
    overdue: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).transform((v) => v === 'true').optional()),
    projectId: optionalId,
    assigneeId: optionalId,
    q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
    sort: z.preprocess(emptyToUndefined, z.enum(['priority', 'dueDate', 'updated', 'created']).optional()),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((d) => !d.dueFrom || !d.dueTo || d.dueFrom <= d.dueTo, {
    message: 'dueFrom must be on or before dueTo',
    path: ['dueFrom'],
  });
export type ListTasksQuery = z.infer<typeof ListTasksQuery>;

const title = z.string().trim().min(3, 'Title must be at least 3 characters').max(200);
const description = z.string().trim().max(5000).nullable();
const dueDate = z.coerce.date().nullable();

export const CreateTaskBody = z
  .object({
    projectId: z.number().int().positive(),
    title,
    description: description.optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    priority: z.nativeEnum(Priority).default('MEDIUM'),
    status: z.nativeEnum(TaskStatus).default('TODO'),
    dueDate: dueDate.optional(),
  })
  .strict();
export type CreateTaskBody = z.infer<typeof CreateTaskBody>;

export const UpdateTaskBody = z
  .object({
    title: title.optional(),
    description: description.optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    priority: z.nativeEnum(Priority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    dueDate: dueDate.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });
export type UpdateTaskBody = z.infer<typeof UpdateTaskBody>;

export const UpdateStatusBody = z
  .object({
    status: z.nativeEnum(TaskStatus),
    /** Optional optimistic-concurrency guard: the status the client last saw. */
    expectedStatus: z.nativeEnum(TaskStatus).optional(),
  })
  .strict();
export type UpdateStatusBody = z.infer<typeof UpdateStatusBody>;
