import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { userRouter } from './modules/users/user.routes';
import { clientRouter } from './modules/clients/client.routes';
import { projectRouter } from './modules/projects/project.routes';
import { taskRouter } from './modules/tasks/task.routes';
import { activityRouter } from './modules/activity/activity.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY_HOPS); // behind Render / Vercel proxy: correct client IP for rate limiting
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/clients', clientRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
