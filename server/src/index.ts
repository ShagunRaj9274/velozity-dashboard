import { createServer } from 'http';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { createApp } from './app';
import { initRealtime } from './realtime/socket';
import { startOverdueJob } from './jobs/overdue.job';

async function main() {
  const app = createApp();
  const httpServer = createServer(app);
  const io = initRealtime(httpServer);
  const job = startOverdueJob();

  httpServer.listen(env.PORT, () => logger.info(`API + WebSocket server listening on :${env.PORT}`));

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    job.stop();
    await io.close(); // also closes the HTTP server
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { err: String(err) });
  process.exit(1);
});
