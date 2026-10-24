import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Starting in production must refuse weak secrets. Runs the real config module in a fresh process. */
const API = path.resolve(__dirname, '..');
function boot(env: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', path.join(__dirname, 'fixtures', 'boot-config.ts')], {
    cwd: API,
    // A minimal environment, so the developer's own settings can't leak in and change the result.
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', NODE_ENV: 'production', MONGODB_URI: 'mongodb://x/y', ...env },
    encoding: 'utf8',
  });
}
const GOOD = { JWT_SECRET: 'x'.repeat(48), ADMIN_PASSWORD: 'a-long-password-1' };

describe('production start-up checks', () => {
  it('starts with strong settings', () => {
    expect(boot(GOOD).stdout).toContain('BOOTED');
  });
  it('refuses a short JWT_SECRET', () => {
    const r = boot({ ...GOOD, JWT_SECRET: 'short-secret' });
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/JWT_SECRET must be at least 32/);
  });
  it('refuses a weak or default ADMIN_PASSWORD', () => {
    for (const pw of ['ChangeMe123!', 'password', 'aaaaaaaaaaaa']) {
      const r = boot({ ...GOOD, ADMIN_PASSWORD: pw });
      expect(r.status, pw).toBe(3);
      expect(r.stderr).toMatch(/ADMIN_PASSWORD/);
    }
  });
  it('refuses to start without the settings at all', () => {
    expect(boot({ JWT_SECRET: '', ADMIN_PASSWORD: '' }).status).toBe(3);
  });
}, 60_000);
