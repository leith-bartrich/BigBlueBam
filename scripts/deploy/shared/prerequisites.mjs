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
 * Check shared prerequisites (platform-agnostic).
 * Docker checks are deferred to platform-specific checkPrerequisites()
 * since Railway deployments don't need Docker locally.
 */
export function checkSharedPrerequisites() {
  console.log(bold('Checking prerequisites...\n'));
  const results = [];

  // 1. Node.js version
  const nodeVer = commandOutput('node -v') || 'unknown';
  console.log(`  ${check} Node.js ${nodeVer}`);
  results.push({ name: 'node', ok: true });

  // 2. Network connectivity (try a lightweight fetch)
  let netOk = false;
  netOk = commandSucceeds('node -e "fetch(\'https://registry-1.docker.io/v2/\').then(()=>process.exit(0)).catch(()=>process.exit(1))"');
  if (!netOk) {
    // Second attempt with a different host
    netOk = commandSucceeds('node -e "fetch(\'https://nodejs.org\').then(()=>process.exit(0)).catch(()=>process.exit(1))"');
  }
  if (netOk) {
    console.log(`  ${check} Network connectivity`);
    results.push({ name: 'network', ok: true });
  } else {
    console.log(`  ${warn} Network connectivity could not be verified`);
    console.log('      Some operations may fail without internet access.');
    results.push({ name: 'network', ok: false, warning: true });
  }

  console.log('');
  return { ok: true, results };
}

/**
 * Check Docker prerequisites — called by Docker Compose platform only.
 * Throws if Docker is not available.
 */
export function checkDockerPrerequisites() {
  const results = [];
  let allOk = true;

  // Docker daemon running
  const dockerOk = commandSucceeds('docker info');
  if (dockerOk) {
    const ver = commandOutput("docker --version") || 'unknown';
    console.log(`  ${check} Docker daemon is running  (${ver.replace('Docker version ', '')})`);
    results.push({ name: 'docker', ok: true });
  } else {
    console.log(`  ${cross} Docker is required for Docker Compose deployment`);
    console.log('');
    console.log('      Install Docker Desktop from:');
    console.log('        macOS:   https://docs.docker.com/desktop/install/mac-install/');
    console.log('        Windows: https://docs.docker.com/desktop/install/windows-install/');
    console.log('        Linux:   https://docs.docker.com/engine/install/');
    console.log('');
    console.log('      After installing, start Docker Desktop and re-run this script.');
    results.push({ name: 'docker', ok: false });
    allOk = false;
  }

  // docker compose available
  if (allOk) {
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
  }

  if (!allOk) {
    throw new Error('Docker is required for this deployment method. Please install Docker and re-run.');
  }

  return { ok: allOk, results };
}
