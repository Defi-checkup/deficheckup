import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

type Environment = 'staging' | 'production';
interface HostingEnvironment {
  name: string;
  workers_dev?: boolean;
  preview_urls?: boolean;
  routes?: { pattern: string; custom_domain: boolean }[];
  route?: unknown;
  compatibility_date: string;
}
interface WorkerEnvironment extends HostingEnvironment {
  vars: { ALLOWED_ORIGINS: string };
  ratelimits: { name: string; namespace_id: string; simple: { limit: number; period: number } }[];
  observability: {
    enabled: boolean;
    logs: { enabled: boolean; invocation_logs: boolean };
    traces: { enabled: boolean };
  };
}
export interface DeploymentSettings {
  stagingWebUrl: string;
  stagingProxyUrl: string;
  turnstile: Record<Environment, { siteKey: string; workerSecrets: string }>;
}
export interface WorkerSettings extends WorkerEnvironment {
  env: { staging: WorkerEnvironment };
}
interface WebEnvironment extends HostingEnvironment {
  main?: string;
  assets: {
    directory: string;
    html_handling: string;
    not_found_handling: string;
    binding?: string;
    run_worker_first?: boolean;
  };
  observability: WorkerEnvironment['observability'];
}
export interface WebSettings extends WebEnvironment {
  env: { staging: WebEnvironment };
}
export interface CommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  capture?: boolean;
  quiet?: boolean;
}
export type Run = (binary: string, args: string[], options: CommandOptions) => string;

export function parseWorkerSettings<T = WorkerSettings>(text: string): T {
  const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', text) as {
    config: T;
    error?: unknown;
  };
  if (parsed.error) throw new Error('Invalid Worker configuration.');
  return parsed.config;
}

export function validateSettings(
  settings: DeploymentSettings,
  worker: WorkerSettings,
  web: WebSettings,
) {
  // Inspect both environments before running any checks or deployment.
  const publicSettings = {
    stagingWebUrl: settings.stagingWebUrl,
    stagingProxyUrl: settings.stagingProxyUrl,
  };
  if (
    /_TO_SET|PLACEHOLDER|REPLACE_ME|\{\{|<[^>]*>/i.test(
      JSON.stringify([publicSettings, worker, web]),
    )
  )
    throw new Error('Fill all deployment placeholders before deploying.');
  if (
    settings.stagingProxyUrl !== 'https://deficheckup-proxy-staging.deficheckup.workers.dev' ||
    settings.stagingWebUrl !== 'https://deficheckup-web-staging.deficheckup.workers.dev'
  )
    throw new Error(
      'Use the reviewed staging Worker HTTPS origins without credentials, path or query.',
    );
  for (const [config, name] of [
    [worker, 'deficheckup-proxy'],
    [web, 'deficheckup-web'],
  ] as const) {
    if (
      config.name !== name ||
      config.workers_dev !== false ||
      config.preview_urls !== false ||
      config.route !== undefined ||
      config.env.staging.name !== `${name}-staging` ||
      config.env.staging.workers_dev !== true ||
      config.env.staging.preview_urls !== false ||
      config.env.staging.route !== undefined ||
      config.env.staging.routes?.length !== 0 ||
      config.compatibility_date !== '2026-10-30'
    )
      throw new Error('Worker names, routes or environments do not match the deployment.');
  }
  const staging = worker.env.staging;
  if (
    worker.vars.ALLOWED_ORIGINS !== 'https://deficheckup.com,https://www.deficheckup.com' ||
    staging.vars.ALLOWED_ORIGINS !== settings.stagingWebUrl
  )
    throw new Error('Worker allowed origins do not match the deployment.');
  for (const config of [web, web.env.staging]) {
    if (
      config.main !== undefined ||
      config.assets.directory !== './dist' ||
      config.assets.html_handling !== 'drop-trailing-slash' ||
      config.assets.not_found_handling !== 'none' ||
      config.assets.binding !== undefined ||
      config.assets.run_worker_first !== undefined ||
      config.observability.enabled !== false ||
      config.observability.logs.enabled !== false ||
      config.observability.logs.invocation_logs !== false ||
      config.observability.traces.enabled !== false
    )
      throw new Error('Repeat the assets-only routing and private observability settings.');
  }
  for (const config of [worker, staging]) {
    const limiter = config.ratelimits;
    const expectedLimits = new Map([
      ['LIMITER', 180],
      ['SAFE_LIMITER', 40],
      ['SOLANA_LIMITER', 130],
      ['ZKSYNC_LITE_LIMITER', 10],
    ]);
    if (
      limiter.length !== expectedLimits.size ||
      new Set(limiter.map(({ name }) => name)).size !== expectedLimits.size ||
      limiter.some(
        ({ name, namespace_id, simple }) =>
          !/^[1-9][0-9]*$/.test(namespace_id) ||
          simple.limit !== expectedLimits.get(name) ||
          simple.period !== 60,
      ) ||
      config.observability.enabled !== true ||
      config.observability.logs.enabled !== true ||
      config.observability.logs.invocation_logs !== false ||
      config.observability.traces.enabled !== false
    )
      throw new Error(
        'Repeat the rate limit and private observability settings in each environment.',
      );
  }
  const ids = [...worker.ratelimits, ...staging.ratelimits].map(({ namespace_id }) => namespace_id);
  if (new Set(ids).size !== ids.length)
    throw new Error('Use separate rate-limit namespaces for every binding and environment.');
}

/** All subprocesses are injected in offline tests. No credentials or request data are read. */
export function deploy(
  args: string[],
  settings: DeploymentSettings,
  worker: WorkerSettings,
  web: WebSettings,
  run: Run,
  root: string,
  processEnvironment: NodeJS.ProcessEnv = process.env,
) {
  const [environment, ...flags] = args;
  if (
    !['staging', 'production'].includes(environment ?? '') ||
    flags.some((flag) => flag !== '--confirm-production') ||
    flags.length > 1 ||
    (environment === 'staging' && flags.length)
  )
    throw new Error('Use staging or production; only production accepts --confirm-production.');
  if (environment === 'production' && !flags.includes('--confirm-production'))
    throw new Error('Production requires --confirm-production.');
  validateSettings(settings, worker, web);
  const turnstile = settings.turnstile?.[environment as Environment];
  if (!turnstile || /TO_SET|PLACEHOLDER|REPLACE_ME/i.test(JSON.stringify(turnstile)))
    throw new Error('Fill the selected environment Turnstile placeholders before deploying.');
  if (
    !/^0x4[A-Za-z0-9_-]{15,}$/.test(turnstile.siteKey) ||
    turnstile.workerSecrets !== 'configured-in-worker'
  )
    throw new Error(
      'Use a real Turnstile site key and confirm both Worker secrets are configured.',
    );
  if (
    turnstile.siteKey ===
    settings.turnstile[environment === 'staging' ? 'production' : 'staging'].siteKey
  )
    throw new Error('Use separate Turnstile widgets for staging and production.');
  if (environment === 'production') {
    for (const [config, domain] of [
      [worker, 'api.deficheckup.com'],
      [web, 'deficheckup.com'],
    ] as const) {
      if (
        config.routes?.length !== 1 ||
        config.routes[0]?.pattern !== domain ||
        config.routes[0]?.custom_domain !== true
      )
        throw new Error('Configure both production custom domains before deploying.');
    }
  }

  const env: NodeJS.ProcessEnv = {
    ...processEnvironment,
    DEFICHECKUP_ENV: environment as Environment,
    PUBLIC_PROXY_URL:
      environment === 'staging' ? settings.stagingProxyUrl : 'https://api.deficheckup.com',
    PUBLIC_TURNSTILE_SITE_KEY: turnstile.siteKey,
    CLOUDFLARE_ENV: '',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    WRANGLER_SEND_METRICS: 'false',
    WRANGLER_HIDE_BANNER: 'true',
    WRANGLER_LOG_PATH: resolve(root, 'node_modules/.cache/wrangler/deploy.log'),
    ASTRO_TELEMETRY_DISABLED: '1',
    TMPDIR: resolve(root, 'node_modules/.cache/deploy-tmp'),
  };
  // Workers Builds can override even an explicit --name. Local release scripts must not.
  delete env.WRANGLER_CI_OVERRIDE_NAME;
  const options = { cwd: root, env };
  function productionGate() {
    if (environment !== 'production') return;
    if (run('git', ['branch', '--show-current'], { ...options, capture: true }).trim() !== 'main')
      throw new Error('Production requires the main branch.');
    if (
      run('git', ['status', '--porcelain', '--untracked-files=all'], {
        ...options,
        capture: true,
      }).trim()
    )
      throw new Error('Production requires a clean git tree, including untracked files.');
  }
  productionGate();
  mkdirSync(env.TMPDIR!, { recursive: true });
  run('pnpm', ['check'], options);
  run('pnpm', ['build'], options);
  // Checks can regenerate tracked files. Recheck immediately before making external changes.
  productionGate();
  // Wrangler is installed in proxy. Absolute paths make cwd irrelevant to config selection.
  const wranglerOptions = { cwd: resolve(root, 'proxy'), env, quiet: true };
  for (const [packageName, config] of [
    ['proxy', worker],
    ['web', web],
  ] as const) {
    const target = environment === 'staging' ? config.env.staging : config;
    run(
      'pnpm',
      [
        'exec',
        'wrangler',
        'deploy',
        '--config',
        resolve(root, packageName, 'wrangler.jsonc'),
        // The empty string selects the top-level environment, overriding CLOUDFLARE_ENV.
        '--env',
        environment === 'staging' ? 'staging' : '',
        '--name',
        target.name,
        '--env-file',
        resolve(root, 'scripts/empty-dev-vars'),
      ],
      wranglerOptions,
    );
  }
}

const run: Run = (binary, args, options) => {
  try {
    const result = execFileSync(binary, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.capture || options.quiet ? 'pipe' : 'inherit',
      encoding: 'utf8',
    });
    return result ?? '';
  } catch {
    // Child errors may contain provider responses or inherited environment values.
    throw new Error(
      options.quiet
        ? 'Deployment command failed. Check Cloudflare configuration without enabling request logs.'
        : 'Required local command failed.',
    );
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '..');
    const settings = JSON.parse(
      readFileSync(resolve(root, 'scripts/deployment.json'), 'utf8'),
    ) as DeploymentSettings;
    const worker = parseWorkerSettings(readFileSync(resolve(root, 'proxy/wrangler.jsonc'), 'utf8'));
    const web = parseWorkerSettings<WebSettings>(
      readFileSync(resolve(root, 'web/wrangler.jsonc'), 'utf8'),
    );
    deploy(process.argv.slice(2), settings, worker, web, run, root);
    console.log('Deployment finished. Complete the environment smoke checks before sharing it.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Deployment refused.');
    process.exitCode = 1;
  }
}
