import 'dotenv/config';
import { z } from 'zod';

/**
 * All configuration comes from the environment and is validated at boot.
 * The process refuses to start with missing / weak secrets instead of
 * silently falling back to a hardcoded default.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900), // 15 min
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /** Comma-separated list of allowed browser origins (CORS + Socket.io). */
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /** node-cron expression for the overdue sweep. Default: every minute. */
  OVERDUE_CRON: z.string().default('* * * * *'),
  /** Reverse-proxy hops in front of the API (Vercel rewrite + Render = 2). Drives req.ip for rate limiting. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
  // eslint-disable-next-line no-console
  console.error('❌ JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  CLIENT_ORIGINS: parsed.data.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};
