import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Single PrismaClient for the process. Uses the Rust-free client with the
 * `pg` driver adapter — no native engine binary to ship to the host.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.isProd ? ['error'] : ['error', 'warn'],
});

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
