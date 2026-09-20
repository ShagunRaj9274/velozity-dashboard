import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { presence } from '../../realtime/presence';
import type { AuthUser } from '../../types/auth';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
} as const;

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt limit
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const CreateUserBody = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password,
    role: z.nativeEnum(Role),
  })
  .strict();

export const UpdateUserBody = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

export const ListUsersQuery = z.object({ role: z.nativeEnum(Role).optional() });

export const userService = {
  async list(role?: Role) {
    const users = await prisma.user.findMany({ where: role ? { role } : {}, select: publicUserSelect, orderBy: [{ role: 'asc' }, { name: 'asc' }] });
    return users.map((u) => ({ ...u, online: presence.isOnline(u.id) }));
  },

  /** Minimal directory used by PM/admin task-assignment pickers. */
  assignableDevelopers() {
    return prisma.user.findMany({
      where: { role: 'DEVELOPER', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  },

  async create(input: z.infer<typeof CreateUserBody>) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    return prisma.user.create({
      data: { name: input.name, email: input.email, role: input.role, passwordHash },
      select: publicUserSelect,
    });
  },

  async update(actor: AuthUser, id: number, input: z.infer<typeof UpdateUserBody>) {
    const target = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { ownedProjects: true } } },
    });
    if (!target) throw AppError.notFound('User');
    if (actor.id === id && (input.role !== undefined || input.isActive === false)) {
      throw AppError.badRequest('You cannot change your own role or deactivate yourself');
    }
    if (input.role === 'DEVELOPER' && target._count.ownedProjects > 0) {
      throw AppError.conflict('This user owns projects. Transfer them before changing the role to Developer.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: input, select: publicUserSelect });
      // Role change or deactivation kills every session immediately.
      if (input.isActive === false || (input.role && input.role !== target.role)) {
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return user;
    });
    return { ...updated, online: presence.isOnline(updated.id) };
  },
};
