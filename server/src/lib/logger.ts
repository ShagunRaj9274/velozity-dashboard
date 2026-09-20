/* Minimal structured logger — JSON in production, readable in development. */
import { env } from '../config/env';

type Level = 'info' | 'warn' | 'error' | 'debug';

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (level === 'debug' && env.isProd) return;
  const line = env.isProd
    ? JSON.stringify({ level, msg, time: new Date().toISOString(), ...meta })
    : `[${level.toUpperCase()}] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
};
