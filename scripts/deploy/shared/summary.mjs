// Deployment summary printer — zero dependencies.

import { bold, green, dim, cyan, blue, yellow, check } from './colors.mjs';
import { APP_URLS, SERVICES, INFRASTRUCTURE } from './services.mjs';

/**
 * Print a formatted deployment summary with URLs, service status, and next steps.
 *
 * @param {{ domain: string, adminEmail?: string, storage: string, vectorDb: string, livekit: string, platform: string }} config
 */
export function printSummary(config) {
  const baseUrl = config.domain === 'localhost'
    ? 'http://localhost'
    : `https://${config.domain}`;

  console.log('');
  console.log(green('================================================================'));
  console.log(green('   BigBlueBam is ready!'));
  console.log(green('================================================================'));
  console.log('');

  // App URLs
  console.log(bold('  Your applications:\n'));
  for (const [key, app] of Object.entries(APP_URLS)) {
    console.log(`    ${check} ${app.label.padEnd(30)} ${cyan(baseUrl + app.path)}`);
  }

  console.log('');
  console.log(bold('  Infrastructure:\n'));

  // Core services
  const coreInfra = INFRASTRUCTURE.filter((i) => i.required);
  for (const svc of coreInfra) {
    console.log(`    ${check} ${svc.description.padEnd(30)} ${dim(svc.image)}`);
  }

  // Optional services
  if (config.storage === 'minio') {
    const minio = INFRASTRUCTURE.find((i) => i.name === 'minio');
    console.log(`    ${check} ${minio.description.padEnd(30)} ${dim(minio.image)}`);
  } else if (config.storage === 's3') {
    console.log(`    ${check} ${'File Storage'.padEnd(30)} ${dim('Amazon S3 (external)')}`);
  } else if (config.storage === 'r2') {
    console.log(`    ${check} ${'File Storage'.padEnd(30)} ${dim('Cloudflare R2 (external)')}`);
  } else {
    console.log(`    ${dim('--')} ${'File Storage'.padEnd(30)} ${dim('not configured')}`);
  }

  if (config.vectorDb === 'qdrant-local') {
    const qdrant = INFRASTRUCTURE.find((i) => i.name === 'qdrant');
    console.log(`    ${check} ${qdrant.description.padEnd(30)} ${dim(qdrant.image)}`);
  } else if (config.vectorDb === 'qdrant-cloud') {
    console.log(`    ${check} ${'Vector Search'.padEnd(30)} ${dim('Qdrant Cloud (external)')}`);
  } else {
    console.log(`    ${dim('--')} ${'Vector Search'.padEnd(30)} ${dim('not configured')}`);
  }

  if (config.livekit === 'livekit-local') {
    const lk = INFRASTRUCTURE.find((i) => i.name === 'livekit');
    console.log(`    ${check} ${lk.description.padEnd(30)} ${dim(lk.image)}`);
  } else if (config.livekit === 'livekit-cloud') {
    console.log(`    ${check} ${'Voice/Video'.padEnd(30)} ${dim('LiveKit Cloud (external)')}`);
  } else {
    console.log(`    ${dim('--')} ${'Voice/Video'.padEnd(30)} ${dim('not configured')}`);
  }

  // Admin account
  console.log('');
  if (config.adminEmail) {
    console.log(bold('  Admin account:\n'));
    console.log(`    Email: ${cyan(config.adminEmail)}`);
    console.log(`    Login: ${cyan(baseUrl + '/helpdesk/')}`);
  }

  // Next steps
  console.log('');
  console.log(bold('  Next steps:\n'));
  console.log(`    1. Open ${cyan(baseUrl + '/helpdesk/')} in your browser`);
  console.log(`    2. Log in with your admin account`);
  console.log(`    3. Create your first project in ${cyan('Bam')}`);
  console.log(`    4. Invite team members from the People page`);
  console.log('');
  console.log(dim('  Useful commands:'));
  console.log(dim('    View logs:     docker compose logs -f'));
  console.log(dim('    Stop:          docker compose down'));
  console.log(dim('    Restart:       docker compose restart'));
  console.log(dim(`    Reconfigure:   node scripts/deploy/main.mjs`));
  console.log('');

  // Platform-specific notes
  if (config.platform === 'docker-compose') {
    console.log(dim('  Data is stored in Docker volumes. Do NOT run "docker compose down -v"'));
    console.log(dim('  unless you want to wipe everything.'));
    console.log('');
  }
}
