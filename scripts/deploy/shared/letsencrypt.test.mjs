// Unit tests for letsencrypt.mjs. We don't actually invoke certbot here
// (that requires a public DNS name and a real Docker daemon); instead we
// test the bits that are pure-functional: rate-limit refusal, cron entry
// formatting, and the platform-conditional task-builder.

import { describe, expect, it } from 'vitest';
import {
  checkLeCompatibility,
  buildRenewalCronEntry,
  buildRenewalTask,
} from './letsencrypt.mjs';

describe('checkLeCompatibility', () => {
  it('approves HTTP_PORT=80', () => {
    expect(checkLeCompatibility(80).ok).toBe(true);
  });

  it('refuses HTTP_PORT=8080 with a clear reason', () => {
    const result = checkLeCompatibility(8080);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/HTTP_PORT is 8080/);
    expect(result.reason).toMatch(/port 80/);
    expect(result.reason).toMatch(/forwarding|forward/);
  });

  it('refuses arbitrary non-80 ports', () => {
    expect(checkLeCompatibility(443).ok).toBe(false);
    expect(checkLeCompatibility(0).ok).toBe(false);
    expect(checkLeCompatibility(65535).ok).toBe(false);
  });
});

describe('buildRenewalCronEntry', () => {
  it('produces a cron line with daily 03:17 schedule', () => {
    const entry = buildRenewalCronEntry({
      projectDir: '/home/op/BigBlueBam',
      composeBin: 'docker compose',
    });
    expect(entry).toMatch(/^17 3 \* \* \*/);
    expect(entry).toContain('cd "/home/op/BigBlueBam"');
    expect(entry).toContain('certbot renew --quiet');
    expect(entry).toContain('--deploy-hook');
    expect(entry).toContain('nginx -s reload');
  });

  it('honors the docker-compose binary override', () => {
    const entry = buildRenewalCronEntry({
      projectDir: '/srv/bbb',
      composeBin: 'docker-compose',
    });
    expect(entry).toContain('docker-compose --profile letsencrypt run --rm certbot');
    expect(entry).not.toContain('docker compose ');
  });

  it('uses --rm so the renewal container is cleaned up', () => {
    const entry = buildRenewalCronEntry({ projectDir: '/x', composeBin: 'docker compose' });
    expect(entry).toContain('run --rm certbot');
  });
});

describe('buildRenewalTask', () => {
  it('returns the right kind for the current platform', () => {
    const task = buildRenewalTask({ projectDir: '/x', composeBin: 'docker compose' });
    if (process.platform === 'win32') {
      expect(task.kind).toBe('task-scheduler');
      expect(task.command).toContain('certbot renew');
      expect(task.instructions.join(' ')).toMatch(/schtasks/);
    } else {
      expect(task.kind).toBe('cron');
      expect(task.entry).toMatch(/^17 3 \* \* \*/);
      expect(task.instructions.join(' ')).toMatch(/crontab -e/);
    }
  });

  it('always includes setup instructions for the operator', () => {
    const task = buildRenewalTask({ projectDir: '/x', composeBin: 'docker compose' });
    expect(Array.isArray(task.instructions)).toBe(true);
    expect(task.instructions.length).toBeGreaterThan(0);
  });
});
