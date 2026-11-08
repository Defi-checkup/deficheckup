import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Official always-pass secret, an ephemeral signing key, no local secret files or remote Worker.
// Provider keys are deliberately absent; recorded offline tests are the normal development path.
try {
  execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'dev',
      '--local',
      '--config',
      `${root}proxy/wrangler.jsonc`,
      '--env',
      '',
      '--env-file',
      `${root}scripts/empty-dev-vars`,
      '--var',
      'ALLOWED_ORIGINS:http://localhost:4321,http://127.0.0.1:4321',
      '--var',
      'TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA',
      '--var',
      `SCAN_PASS_SECRET:${randomBytes(32).toString('hex')}`,
    ],
    {
      cwd: `${root}proxy`,
      stdio: 'inherit',
      env: {
        ...process.env,
        CLOUDFLARE_ENV: '',
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
        WRANGLER_HIDE_BANNER: 'true',
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_LOG_LEVEL: 'error',
        WRANGLER_LOG_PATH: `${root}proxy/.wrangler/logs`,
      },
    },
  );
} catch {
  // Child errors include argv. Never print the ephemeral signing key from an error object.
  console.error('Local proxy stopped.');
  process.exitCode = 1;
}
