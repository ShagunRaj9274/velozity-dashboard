import type { Role } from '@prisma/client';

/** The authenticated principal. Role is always read from the DB, never trusted from the token. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
