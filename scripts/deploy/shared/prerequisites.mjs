// Shared prerequisite checks — zero dependencies (node:child_process only).

import { execSync } from 'node:child_process';
import { check, cross, warn, bold } from './colors.mjs';

/**
 * Run a command silently and return true if it exits 0.
 */
function commandSucceeds(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get stdout from a command, or null on failure.
 */
function commandOutput(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', timeout: 15_000 }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * Check all shared prerequisites. Returns { ok, results }.
 * Throws if any required check fails.
 */
export function checkSharedPrerequisites() {
  console.log(bold('Checking prerequisites...\n'));
  const results = [];
  let allOk = true;

  // 1. Docker daemon running
  const dockerOk = commandSucceeds('docker info');
  if (dockerOk) {
    const ver = commandOutput("docker --version") || 'unknown';
    console.log(`  ${check} Docker daemon is running  (${ver.replace('Docker version ', '')})`);
    results.push({ name: 'docker', ok: true });
  } else {
    console.log(`  ${cross} Docker daemon is not running`);
    console.log('      Start Docker Desktop, then re-run this setup.');
    results.push({ name: 'docker', ok: false });
    allOk = false;
  }

  // 2. docker compose available
  const composeOk = commandSucceeds('docker compose version');
  if (composeOk) {
    const ver = commandOutput('docker compose version --short') || 'unknown';
    console.log(`  ${check} Docker Compose available  (${ver})`);
    results.push({ name: 'compose', ok: true });
  } else {
    console.log(`  ${cross} Docker Compose not found`);
    console.log('      Docker Compose v2 is included with Docker Desktop.');
    console.log('      If using Linux without Desktop, install the compose plugin.');
    results.push({ name: 'compose', ok: false });
    allOk = false;
  }

  // 3. Network connectivity
  let netOk = false;
  try {
    execSync('docker pull --quiet hello-world', { stdio: 'pipe', timeout: 30_000 });
    netOk = true;
  } catch {
    // Fall back to a simple DNS check
    netOk = commandSucceeds('node -e "fetch(\'https://registry-1.docker.io/v2/\').then(()=>process.exit(0)).catch(()=>process.exit(1))"');
  }
  if (netOk) {
    console.log(`  ${check} Network connectivity`);
    results.push({ name: 'network', ok: true });
  } else {
    console.log(`  ${warn} Network connectivity could not be verified`);
    console.log('      Docker image pulls may fail without internet access.');
    results.push({ name: 'network', ok: false, warning: true });
  }

  console.log('');

  if (!allOk) {
    throw new Error('Required prerequisites are missing. Please fix the issues above and re-run.');
  }

  return { ok: allOk, results };
}
