import { execSync } from 'child_process';

/** Re-seed before the run so every test starts from the documented dataset. */
export default function setup() {
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
}
