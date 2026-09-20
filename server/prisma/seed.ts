/**
 * Seed script — creates a realistic, internally consistent demo dataset:
 *   • 1 admin, 2 project managers, 4 developers   (password for all: Password@123)
 *   • 4 clients, 4 projects, 22 tasks across every status and priority
 *   • 4 tasks already overdue (flagged, with TASK_OVERDUE activity)
 *   • A chronological activity history that REPLAYS each task's life
 *     (created → In Progress → In Review → Done), so the log matches task state
 *   • Notifications (assignments, review requests, overdue alerts), some unread
 *   • Every user's lastSeenAt = 5h ago, so the "while you were away" catch-up
 *     has real events to show on first login
 *
 * Usage:  npm run db:seed              (wipes and re-seeds)
 *         node dist/prisma/seed.js --if-empty   (production boot: seeds only an empty DB)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma, type Priority, type Role, type TaskStatus } from '@prisma/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const DEMO_PASSWORD = 'Password@123';
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const hoursAgo = (h: number) => new Date(NOW - h * HOUR);
const daysFromNow = (d: number) => new Date(NOW + d * DAY);
const LAST_SEEN_HOURS_AGO = 5;

type UserKey = 'admin' | 'priya' | 'karan' | 'ravi' | 'sneha' | 'arjun' | 'meera';

const USERS: Record<UserKey, { name: string; email: string; role: Role }> = {
  admin: { name: 'Aarav Mehta', email: 'admin@velozity.dev', role: 'ADMIN' },
  priya: { name: 'Priya Sharma', email: 'priya@velozity.dev', role: 'PROJECT_MANAGER' },
  karan: { name: 'Karan Malhotra', email: 'karan@velozity.dev', role: 'PROJECT_MANAGER' },
  ravi: { name: 'Ravi Kumar', email: 'ravi@velozity.dev', role: 'DEVELOPER' },
  sneha: { name: 'Sneha Iyer', email: 'sneha@velozity.dev', role: 'DEVELOPER' },
  arjun: { name: 'Arjun Nair', email: 'arjun@velozity.dev', role: 'DEVELOPER' },
  meera: { name: 'Meera Joshi', email: 'meera@velozity.dev', role: 'DEVELOPER' },
};

interface TaskSpec {
  title: string;
  description: string;
  assignee: UserKey;
  priority: Priority;
  status: TaskStatus;
  /** days relative to now; negative = in the past */
  dueInDays: number;
  createdDaysAgo: number;
  /** when the task reached its current status */
  lastMoveHoursAgo?: number;
}

interface ProjectSpec {
  name: string;
  description: string;
  client: string;
  owner: UserKey;
  createdDaysAgo: number;
  tasks: TaskSpec[];
}

const CLIENTS = [
  { name: 'Northwind Retail', company: 'Northwind Retail Pvt Ltd', email: 'ops@northwind.example' },
  { name: 'Bluepeak Health', company: 'Bluepeak Health Systems', email: 'it@bluepeak.example' },
  { name: 'Solstice Fintech', company: 'Solstice Financial Technologies', email: 'product@solstice.example' },
  { name: 'Orbit Logistics', company: 'Orbit Logistics & Freight', email: 'tech@orbit.example' },
];

// Tasks are inserted in this order, so the task numbers (#1…#22) follow this list.
const PROJECTS: ProjectSpec[] = [
  {
    name: 'Northwind Storefront Revamp',
    description: 'Rebuild of the Northwind e-commerce storefront: new design system, faster PLP, streamlined checkout.',
    client: 'Northwind Retail',
    owner: 'priya',
    createdDaysAgo: 22,
    tasks: [
      { title: 'Design system tokens & component audit', description: 'Inventory existing components, define colour/spacing/type tokens and publish them in Storybook.', assignee: 'sneha', priority: 'MEDIUM', status: 'DONE', dueInDays: -6, createdDaysAgo: 18, lastMoveHoursAgo: 5 * 24 },
      { title: 'Product listing page with faceted filters', description: 'PLP with category, price and size facets. Filters must be reflected in the URL.', assignee: 'ravi', priority: 'HIGH', status: 'IN_REVIEW', dueInDays: 2, createdDaysAgo: 14, lastMoveHoursAgo: 3 },
      { title: 'Checkout flow: address & payment steps', description: 'Two-step checkout with address autocomplete and Razorpay integration.', assignee: 'ravi', priority: 'CRITICAL', status: 'IN_PROGRESS', dueInDays: 4, createdDaysAgo: 12, lastMoveHoursAgo: 48 },
      { title: 'Migrate product images to CDN', description: 'Move ~12k product images to the CDN and serve responsive srcsets.', assignee: 'arjun', priority: 'LOW', status: 'TODO', dueInDays: 10, createdDaysAgo: 6 },
      { title: 'Fix cart badge desync across tabs', description: 'Cart count goes stale when the cart is modified in another tab.', assignee: 'sneha', priority: 'HIGH', status: 'IN_PROGRESS', dueInDays: -1, createdDaysAgo: 9, lastMoveHoursAgo: 4 * 24 },
      { title: 'Lighthouse performance pass (LCP < 2.5s)', description: 'Hit LCP under 2.5s on the home page and PLP on a mid-range Android device.', assignee: 'arjun', priority: 'MEDIUM', status: 'TODO', dueInDays: 6, createdDaysAgo: 5 },
    ],
  },
  {
    name: 'Bluepeak Patient Portal',
    description: 'Self-service portal for Bluepeak patients: appointments, lab reports, secure messaging.',
    client: 'Bluepeak Health',
    owner: 'priya',
    createdDaysAgo: 24,
    tasks: [
      { title: 'Appointment booking calendar', description: 'Doctor availability calendar with slot holds and confirmation emails.', assignee: 'meera', priority: 'HIGH', status: 'IN_REVIEW', dueInDays: 1, createdDaysAgo: 15, lastMoveHoursAgo: 26 },
      { title: 'Secure document upload for lab reports', description: 'Encrypted upload with virus scanning and signed download URLs.', assignee: 'ravi', priority: 'CRITICAL', status: 'TODO', dueInDays: -0.1, createdDaysAgo: 8 },
      { title: 'Audit log for patient-record access', description: 'Record every read of patient data with actor, reason and timestamp.', assignee: 'meera', priority: 'HIGH', status: 'DONE', dueInDays: -3, createdDaysAgo: 20, lastMoveHoursAgo: 2 },
      { title: 'Patient onboarding email templates', description: 'Welcome, verification and first-appointment reminder emails.', assignee: 'sneha', priority: 'LOW', status: 'DONE', dueInDays: -8, createdDaysAgo: 21, lastMoveHoursAgo: 9 * 24 },
      { title: 'Accessibility review (WCAG 2.1 AA)', description: 'Screen-reader and keyboard audit of booking and reports flows.', assignee: 'arjun', priority: 'MEDIUM', status: 'IN_PROGRESS', dueInDays: 5, createdDaysAgo: 7, lastMoveHoursAgo: 1 },
    ],
  },
  {
    name: 'Solstice Mobile Banking',
    description: 'React Native banking app for Solstice: onboarding, KYC, cards and transactions.',
    client: 'Solstice Fintech',
    owner: 'karan',
    createdDaysAgo: 25,
    tasks: [
      { title: 'Biometric login (Face ID / fingerprint)', description: 'Opt-in biometric unlock backed by the device keystore.', assignee: 'ravi', priority: 'HIGH', status: 'IN_REVIEW', dueInDays: 3, createdDaysAgo: 10, lastMoveHoursAgo: 0.4 },
      { title: 'Transaction history with infinite scroll', description: 'Cursor-paginated history with merchant logos and search.', assignee: 'arjun', priority: 'MEDIUM', status: 'DONE', dueInDays: -2, createdDaysAgo: 16, lastMoveHoursAgo: 3 * 24 },
      { title: 'KYC document verification flow', description: 'PAN + Aadhaar capture, OCR and liveness check via the vendor SDK.', assignee: 'meera', priority: 'CRITICAL', status: 'IN_PROGRESS', dueInDays: -2, createdDaysAgo: 13, lastMoveHoursAgo: 6 * 24 },
      { title: 'Push notifications for large transactions', description: 'Notify users of debits above their configured threshold.', assignee: 'sneha', priority: 'MEDIUM', status: 'TODO', dueInDays: 8, createdDaysAgo: 4 },
      { title: 'Rate-limit the OTP endpoint', description: 'Per-phone and per-IP limits with exponential back-off.', assignee: 'ravi', priority: 'HIGH', status: 'DONE', dueInDays: -5, createdDaysAgo: 17, lastMoveHoursAgo: 6 * 24 },
      { title: 'Card freeze / unfreeze toggle', description: 'Instant freeze from the card screen with confirmation sheet.', assignee: 'meera', priority: 'LOW', status: 'TODO', dueInDays: 12, createdDaysAgo: 3 },
    ],
  },
  {
    name: 'Orbit Fleet Tracker',
    description: 'Real-time fleet tracking dashboard for Orbit dispatchers.',
    client: 'Orbit Logistics',
    owner: 'karan',
    createdDaysAgo: 20,
    tasks: [
      { title: 'Live vehicle map with streaming positions', description: 'Map view with vehicle markers updated from the telematics stream.', assignee: 'arjun', priority: 'CRITICAL', status: 'IN_PROGRESS', dueInDays: 2, createdDaysAgo: 11, lastMoveHoursAgo: 3.5 },
      { title: 'Geofence alerts for depots', description: 'Alert dispatchers when vehicles enter or leave depot geofences.', assignee: 'sneha', priority: 'HIGH', status: 'IN_REVIEW', dueInDays: 1, createdDaysAgo: 9, lastMoveHoursAgo: 1.5 },
      { title: 'Driver shift report CSV export', description: 'Daily CSV of driver shifts, idle time and distance.', assignee: 'meera', priority: 'MEDIUM', status: 'TODO', dueInDays: -1.5, createdDaysAgo: 10 },
      { title: 'Route replay timeline', description: 'Scrub through a vehicle’s route for any past day.', assignee: 'ravi', priority: 'MEDIUM', status: 'TODO', dueInDays: 9, createdDaysAgo: 2 },
      { title: 'Fuel usage dashboard', description: 'Fuel consumption per vehicle with anomaly highlighting.', assignee: 'arjun', priority: 'LOW', status: 'DONE', dueInDays: -4, createdDaysAgo: 19, lastMoveHoursAgo: 5 * 24 },
    ],
  },
];

const FLOW: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

async function main() {
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('ℹ️  Database already has data — skipping seed (--if-empty).');
    return;
  }

  console.log('🌱 Seeding database…');
  // Seed scripts may use raw SQL: this resets tables AND id sequences so task numbers are stable.
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Notification", "ActivityLog", "RefreshToken", "Task", "Project", "Client", "User" RESTART IDENTITY CASCADE',
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = {} as Record<UserKey, { id: number; name: string }>;
  for (const [key, u] of Object.entries(USERS) as [UserKey, (typeof USERS)[UserKey]][]) {
    const created = await prisma.user.create({
      data: { ...u, passwordHash, lastSeenAt: hoursAgo(LAST_SEEN_HOURS_AGO), createdAt: hoursAgo(30 * 24) },
    });
    users[key] = { id: created.id, name: created.name };
  }

  const clients = new Map<string, number>();
  for (const c of CLIENTS) {
    const created = await prisma.client.create({ data: { ...c, createdAt: hoursAgo(28 * 24) } });
    clients.set(c.name, created.id);
  }

  const activities: Prisma.ActivityLogCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  let overdueCount = 0;
  let taskCount = 0;

  for (const p of PROJECTS) {
    const owner = users[p.owner];
    const projectCreatedAt = hoursAgo(p.createdDaysAgo * 24);
    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: p.description,
        clientId: clients.get(p.client)!,
        ownerId: owner.id,
        createdAt: projectCreatedAt,
      },
    });
    activities.push({ type: 'PROJECT_CREATED', projectId: project.id, actorId: owner.id, createdAt: projectCreatedAt });

    for (const t of p.tasks) {
      const assignee = users[t.assignee];
      const createdAt = hoursAgo(t.createdDaysAgo * 24);
      const dueDate = daysFromNow(t.dueInDays);
      const isOverdue = t.status !== 'DONE' && dueDate.getTime() < NOW;
      const overdueSince = isOverdue ? new Date(dueDate.getTime() + 60_000) : null;

      const task = await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          dueDate,
          isOverdue,
          overdueSince,
          projectId: project.id,
          assigneeId: assignee.id,
          createdById: owner.id,
          createdAt,
        },
      });
      taskCount++;

      activities.push({
        type: 'TASK_CREATED',
        projectId: project.id,
        taskId: task.id,
        actorId: owner.id,
        toStatus: 'TODO',
        meta: { assigneeName: assignee.name },
        createdAt,
      });
      notifications.push({
        userId: assignee.id,
        type: 'TASK_ASSIGNED',
        title: `New task: #${task.id} ${t.title}`,
        body: `${owner.name} assigned you "${t.title}" in ${p.name}.`,
        taskId: task.id,
        createdAt,
        readAt: t.createdDaysAgo > 2 ? new Date(createdAt.getTime() + 2 * HOUR) : null,
      });

      // Replay the status history so the log is consistent with the current status.
      const steps = FLOW.indexOf(t.status);
      if (steps > 0) {
        const end = hoursAgo(t.lastMoveHoursAgo ?? 12);
        const start = createdAt.getTime() + 3 * HOUR;
        const gap = (end.getTime() - start) / steps;
        for (let i = 1; i <= steps; i++) {
          const from = FLOW[i - 1]!;
          const to = FLOW[i]!;
          const at = i === steps ? end : new Date(start + gap * (i - 1));
          const actor = to === 'DONE' ? owner : assignee; // PM approves review → Done
          activities.push({
            type: 'STATUS_CHANGED',
            projectId: project.id,
            taskId: task.id,
            actorId: actor.id,
            fromStatus: from,
            toStatus: to,
            createdAt: at,
          });
          if (to === 'IN_REVIEW') {
            notifications.push({
              userId: owner.id,
              type: 'TASK_IN_REVIEW',
              title: `Ready for review: #${task.id} ${t.title}`,
              body: `${assignee.name} moved "${t.title}" to In Review in ${p.name}.`,
              taskId: task.id,
              createdAt: at,
              readAt: NOW - at.getTime() > DAY ? new Date(at.getTime() + HOUR) : null,
            });
          }
        }
      }

      if (isOverdue && overdueSince) {
        overdueCount++;
        activities.push({
          type: 'TASK_OVERDUE',
          projectId: project.id,
          taskId: task.id,
          actorId: null,
          meta: { dueDate: dueDate.toISOString() },
          createdAt: overdueSince,
        });
        notifications.push({
          userId: assignee.id,
          type: 'TASK_OVERDUE',
          title: `Overdue: #${task.id} ${t.title}`,
          body: `"${t.title}" passed its due date and is now flagged overdue.`,
          taskId: task.id,
          createdAt: overdueSince,
        });
      }
    }
  }

  // A couple of non-status edits for a richer history.
  activities.push({
    type: 'TASK_UPDATED',
    projectId: 1,
    taskId: 3,
    actorId: users.priya.id,
    meta: { fields: ['priority'] },
    createdAt: hoursAgo(30),
  });
  activities.push({
    type: 'TASK_UPDATED',
    projectId: 3,
    taskId: 14,
    actorId: users.karan.id,
    meta: { fields: ['due date', 'description'] },
    createdAt: hoursAgo(7 * 24),
  });

  // Insert in chronological order so ids increase with time.
  activities.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  notifications.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  await prisma.activityLog.createMany({ data: activities });
  await prisma.notification.createMany({ data: notifications });

  console.log(`✅ Seeded ${Object.keys(users).length} users, ${CLIENTS.length} clients, ${PROJECTS.length} projects, ${taskCount} tasks`);
  console.log(`   ${activities.length} activity events, ${notifications.length} notifications, ${overdueCount} overdue tasks`);
  console.log(`   Sign in with any seeded email and password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
