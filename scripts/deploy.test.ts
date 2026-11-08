import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  deploy,
  parseWorkerSettings,
  validateSettings,
  type Run,
  type WebSettings,
} from './deploy';

const root = resolve(import.meta.dirname, '..');
const checkedIn = () =>
  parseWorkerSettings(readFileSync(resolve(root, 'proxy/wrangler.jsonc'), 'utf8'));
const checkedInWeb = () =>
  parseWorkerSettings<WebSettings>(readFileSync(resolve(root, 'web/wrangler.jsonc'), 'utf8'));
const checkedInSettings = JSON.parse(
  readFileSync(resolve(root, 'scripts/deployment.json'), 'utf8'),
);
// The checked-in file holds real keys once configured; refusal tests need placeholders.
const unresolved = {
  ...checkedInSettings,
  turnstile: {
    staging: {
      siteKey: 'STAGING_TURNSTILE_SITE_KEY_TO_SET',
      workerSecrets: 'WORKER_SECRETS_TO_SET',
    },
    production: {
      siteKey: 'PRODUCTION_TURNSTILE_SITE_KEY_TO_SET',
      workerSecrets: 'WORKER_SECRETS_TO_SET',
    },
  },
};
// Synthetic public identifiers for offline orchestration tests, never dashboard widget keys.
const settings = {
  ...unresolved,
  turnstile: {
    staging: { siteKey: '0x4OFFLINEONLYstagingSiteKey', workerSecrets: 'configured-in-worker' },
    production: {
      siteKey: '0x4OFFLINEONLYproductionSiteKey',
      workerSecrets: 'configured-in-worker',
    },
  },
};
function configuredWeb() {
  const web = checkedInWeb();
  web.routes = [{ pattern: 'deficheckup.com', custom_domain: true }];
  return web;
}
function configured() {
  const worker = checkedIn();
  worker.workers_dev = false;
  worker.preview_urls = false;
  worker.routes = [{ pattern: 'api.deficheckup.com', custom_domain: true }];
  return worker;
}
function mockCommands(branch = 'main', status = '') {
  // These stand in for git, pnpm and Wrangler. No subprocess can run in this suite.
  return vi.fn<Run>((binary, args) =>
    binary === 'git' ? (args[0] === 'branch' ? branch : status) : '',
  );
}

describe('environment deployment', () => {
  it.each(['staging', 'production'])(
    'refuses Turnstile placeholders and test keys before any command in %s',
    (environment) => {
      for (const candidate of [
        unresolved,
        ...[
          { siteKey: '1x00000000000000000000AA' },
          { siteKey: '1x00000000000000000000BB' },
          { siteKey: '' },
          { workerSecrets: '' },
          { workerSecrets: 'WORKER_SECRETS_TO_SET' },
          {
            siteKey:
              settings.turnstile[environment === 'staging' ? 'production' : 'staging'].siteKey,
          },
        ].map((value) => ({
          ...settings,
          turnstile: {
            ...settings.turnstile,
            [environment]: {
              ...settings.turnstile[environment as 'staging' | 'production'],
              ...value,
            },
          },
        })),
      ]) {
        const run = mockCommands();
        expect(() =>
          deploy(
            [environment, ...(environment === 'production' ? ['--confirm-production'] : [])],
            candidate,
            configured(),
            configuredWeb(),
            run,
            root,
          ),
        ).toThrow(/Turnstile|Worker secrets/);
        expect(run).not.toHaveBeenCalled();
      }
    },
  );

  it('allows staging setup while production Turnstile placeholders remain', () => {
    const candidate = {
      ...settings,
      turnstile: { ...settings.turnstile, production: unresolved.turnstile.production },
    };
    expect(() =>
      deploy(['staging'], candidate, checkedIn(), checkedInWeb(), mockCommands(), root),
    ).not.toThrow();
  });
  it('accepts the real settings and refuses production without both custom domains', () => {
    const run = mockCommands();
    deploy(['staging'], settings, checkedIn(), checkedInWeb(), run, root);
    expect(run.mock.calls.filter(([, args]) => args.includes('wrangler'))).toHaveLength(2);
    expect(checkedIn().routes).toEqual([{ pattern: 'api.deficheckup.com', custom_domain: true }]);
    expect(checkedInWeb().routes).toEqual([{ pattern: 'deficheckup.com', custom_domain: true }]);
    const noWorkerDomain = checkedIn();
    noWorkerDomain.routes = [];
    const noWebDomain = checkedInWeb();
    noWebDomain.routes = [];
    for (const [worker, web] of [
      [noWorkerDomain, checkedInWeb()],
      [checkedIn(), noWebDomain],
    ] as const) {
      expect(() =>
        deploy(['production', '--confirm-production'], settings, worker, web, mockCommands(), root),
      ).toThrow(/custom domains/);
    }
  });

  it('pins an assets-only web Worker with the same routing contract in both environments', () => {
    const web = checkedInWeb();
    for (const config of [web, web.env.staging]) {
      expect(config.main).toBeUndefined();
      expect(config.assets).toEqual({
        directory: './dist',
        html_handling: 'drop-trailing-slash',
        not_found_handling: 'none',
      });
      expect(config.observability).toEqual({
        enabled: false,
        logs: { enabled: false, invocation_logs: false },
        traces: { enabled: false },
      });
    }
    expect(() => validateSettings(settings, checkedIn(), web)).not.toThrow();
  });

  it.each(['staging', 'production'])(
    'rejects crossed Worker names in every config before deploying %s',
    (environment) => {
      for (const packageName of ['proxy', 'web']) {
        for (const target of ['staging', 'production']) {
          const worker = configured();
          const web = configuredWeb();
          const config = packageName === 'proxy' ? worker : web;
          if (target === 'staging') config.env.staging.name = config.name;
          else config.name = config.env.staging.name;
          const run = mockCommands();
          expect(() =>
            deploy(
              [environment, ...(environment === 'production' ? ['--confirm-production'] : [])],
              settings,
              worker,
              web,
              run,
              root,
            ),
          ).toThrow(/names/);
          expect(run).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('rejects web route inheritance, scripts, SPA fallback and request logging', () => {
    for (const mutate of [
      (web: WebSettings) => {
        delete web.env.staging.routes;
      },
      (web: WebSettings) => {
        web.env.staging.routes = [{ pattern: 'deficheckup.com', custom_domain: true }];
      },
      (web: WebSettings) => {
        web.env.staging.route = 'deficheckup.com/*';
      },
      (web: WebSettings) => {
        web.env.staging.main = '../proxy/src/index.ts';
      },
      (web: WebSettings) => {
        web.env.staging.assets.directory = '../proxy';
      },
      (web: WebSettings) => {
        web.env.staging.assets.html_handling = 'auto-trailing-slash';
      },
      (web: WebSettings) => {
        web.env.staging.assets.not_found_handling = 'single-page-application';
      },
      (web: WebSettings) => {
        web.env.staging.observability.logs.invocation_logs = true;
      },
      (web: WebSettings) => {
        web.env.staging.preview_urls = true;
      },
    ]) {
      const web = configuredWeb();
      mutate(web);
      const run = mockCommands();
      expect(() => deploy(['staging'], settings, configured(), web, run, root)).toThrow();
      expect(run).not.toHaveBeenCalled();
    }
    const web = checkedInWeb();
    web.routes = [];
    expect(() =>
      deploy(
        ['production', '--confirm-production'],
        settings,
        configured(),
        web,
        mockCommands(),
        root,
      ),
    ).toThrow(/custom domains/);
  });

  it('repeats non-inherited bindings and explicitly pins privacy in the staging config', () => {
    const worker = checkedIn();
    const staging = worker.env.staging;
    expect(staging.name).toBe('deficheckup-proxy-staging');
    expect(staging.workers_dev).toBe(true);
    expect(staging.preview_urls).toBe(false);
    expect(staging.routes).toEqual([]);
    const deployment = JSON.parse(readFileSync(resolve(root, 'scripts/deployment.json'), 'utf8'));
    expect(staging.vars).toEqual({
      ALLOWED_ORIGINS: deployment.stagingWebUrl,
    });
    for (const config of [worker, staging]) {
      expect(config.ratelimits.map(({ name, simple }) => ({ name, simple }))).toEqual([
        { name: 'LIMITER', simple: { limit: 180, period: 60 } },
        { name: 'SAFE_LIMITER', simple: { limit: 40, period: 60 } },
        { name: 'SOLANA_LIMITER', simple: { limit: 130, period: 60 } },
        { name: 'ZKSYNC_LITE_LIMITER', simple: { limit: 10, period: 60 } },
      ]);
    }
    const ids = [...worker.ratelimits, ...staging.ratelimits].map(
      ({ namespace_id }) => namespace_id,
    );
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(staging.observability).toEqual({
      enabled: true,
      logs: { enabled: true, invocation_logs: false },
      traces: { enabled: false },
    });
    expect(staging.observability).toEqual(worker.observability);
  });

  it.each(['staging', 'production'])(
    'refuses unresolved placeholders for %s before invoking any command',
    (environment) => {
      const actualSettings = { ...settings, stagingWebUrl: 'WEB_ORIGIN_TO_SET' };
      const run = mockCommands();
      expect(() =>
        deploy(
          [environment, ...(environment === 'production' ? ['--confirm-production'] : [])],
          actualSettings,
          checkedIn(),
          configuredWeb(),
          run,
          root,
        ),
      ).toThrow(/placeholders/);
      expect(run).not.toHaveBeenCalled();
    },
  );

  it('refuses each unresolved placeholder, invalid public URL and mismatched origin independently', () => {
    for (const setting of [
      { ...settings, stagingWebUrl: 'WEB_ORIGIN_TO_SET' },
      {
        ...settings,
        stagingProxyUrl: 'https://deficheckup-proxy-staging.SUBDOMAIN_TO_SET.workers.dev',
      },
      { ...settings, stagingProxyUrl: '' },
      {
        ...settings,
        stagingProxyUrl:
          'https://deficheckup-proxy-staging.offline-account.workers.dev?key=synthetic',
      },
      {
        ...settings,
        stagingProxyUrl: 'https://deficheckup-proxy-stagingXoffline-accountXworkersXdev',
      },
      {
        ...settings,
        stagingProxyUrl:
          'https://user:synthetic@deficheckup-proxy-staging.offline-account.workers.dev',
      },
      { ...settings, stagingWebUrl: '' },
      { ...settings, stagingWebUrl: 'https://another-worker.deficheckup.workers.dev' },
    ]) {
      const run = mockCommands();
      expect(() =>
        deploy(['staging'], setting, configured(), configuredWeb(), run, root),
      ).toThrow();
      expect(run).not.toHaveBeenCalled();
    }
    const worker = configured();
    worker.env.staging.vars.ALLOWED_ORIGINS = 'WEB_ORIGIN_TO_SET';
    expect(() => validateSettings(settings, worker, configuredWeb())).toThrow(/placeholders/);
  });

  it.each([
    {
      args: ['production'],
      branch: 'main',
      status: '',
      message: /confirmation|confirm-production/,
    },
    {
      args: ['production', '--confirm-production'],
      branch: 'feature',
      status: '',
      message: /main branch/,
    },
    {
      args: ['production', '--confirm-production'],
      branch: '',
      status: '',
      message: /main branch/,
    },
    ...[' M file.ts', 'M  file.ts', '?? untracked.txt'].map((status) => ({
      args: ['production', '--confirm-production'],
      branch: 'main',
      status,
      message: /clean git tree/,
    })),
    {
      args: ['staging', '--confirm-production'],
      branch: 'main',
      status: '',
      message: /only production/,
    },
    { args: ['production', '--force'], branch: 'main', status: '', message: /only production/ },
    { args: ['preview'], branch: 'main', status: '', message: /only production/ },
  ])(
    'refuses forbidden deploy: $args, branch $branch, status $status',
    ({ args, branch, status, message }) => {
      const run = mockCommands(branch, status);
      expect(() => deploy(args, settings, configured(), configuredWeb(), run, root)).toThrow(
        message,
      );
      expect(run.mock.calls.filter(([binary]) => binary !== 'git')).toEqual([]);
    },
  );

  it('refuses production before domain configuration, even with confirmation and clean main', () => {
    for (const key of ['workers_dev', 'preview_urls', 'routes'] as const) {
      const worker = configured();
      delete worker[key];
      const run = mockCommands();
      expect(() =>
        deploy(
          ['production', '--confirm-production'],
          settings,
          worker,
          configuredWeb(),
          run,
          root,
        ),
      ).toThrow(/custom domain|environments/);
      expect(run).not.toHaveBeenCalled();
    }
  });

  it('refuses shared limit state, unsafe observability and inherited staging routes', () => {
    for (const mutate of [
      (worker: ReturnType<typeof configured>) => {
        worker.env.staging.ratelimits = [];
      },
      (worker: ReturnType<typeof configured>) => {
        worker.env.staging.ratelimits[0]!.namespace_id = worker.ratelimits[0]!.namespace_id;
      },
      (worker: ReturnType<typeof configured>) => {
        worker.env.staging.observability.logs.invocation_logs = true;
      },
      (worker: ReturnType<typeof configured>) => {
        worker.env.staging.observability.traces.enabled = true;
      },
      (worker: ReturnType<typeof configured>) => {
        delete worker.env.staging.routes;
      },
    ]) {
      const worker = configured();
      mutate(worker);
      const run = mockCommands();
      expect(() => deploy(['staging'], settings, worker, configuredWeb(), run, root)).toThrow();
      expect(run).not.toHaveBeenCalled();
    }
  });

  it('rejects shared namespaces between any pair of route or environment bindings', () => {
    for (const environment of ['production', 'staging'] as const) {
      for (const index of [0, 1, 2, 3]) {
        const worker = configured();
        const target = environment === 'production' ? worker : worker.env.staging;
        // The first production binding collides with another binding in its own environment.
        target.ratelimits[index]!.namespace_id =
          worker.ratelimits[index === 0 ? 1 : 0]!.namespace_id;
        expect(() => validateSettings(settings, worker, configuredWeb())).toThrow(
          /separate rate-limit/,
        );
      }
    }
  });

  it('refuses missing or changed route limits before deploying', () => {
    for (const target of ['production', 'staging'] as const) {
      for (const mutate of [
        (config: ReturnType<typeof configured>) => {
          config.ratelimits.pop();
        },
        ...[0, 1, 2, 3].map((index) => (config: ReturnType<typeof configured>) => {
          config.ratelimits[index]!.simple.limit = [700, 80, 260, 20][index]!;
        }),
        (config: ReturnType<typeof configured>) => {
          config.ratelimits[1]!.simple.limit = 300;
        },
        (config: ReturnType<typeof configured>) => {
          config.ratelimits[2]!.simple.period = 10;
        },
        (config: ReturnType<typeof configured>) => {
          config.ratelimits[3]!.name = 'LIMITER';
        },
      ]) {
        const worker = configured();
        // Each target shares the WorkerEnvironment shape; env is unused by these mutations.
        mutate(
          (target === 'production' ? worker : worker.env.staging) as ReturnType<typeof configured>,
        );
        const run = mockCommands();
        expect(() => deploy(['staging'], settings, worker, configuredWeb(), run, root)).toThrow();
        expect(run).not.toHaveBeenCalled();
      }
    }
  });

  it.each(['staging', 'production'])(
    'checks and audits the correct build before deploying %s',
    (environment) => {
      const run = mockCommands();
      deploy(
        [environment, ...(environment === 'production' ? ['--confirm-production'] : [])],
        settings,
        configured(),
        configuredWeb(),
        run,
        root,
        {
          PUBLIC_PROXY_URL: 'https://wrong.example',
          PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
          DEFICHECKUP_ENV: 'wrong',
          CLOUDFLARE_ENV: environment === 'staging' ? 'production' : 'staging',
          WRANGLER_CI_OVERRIDE_NAME:
            environment === 'staging' ? 'deficheckup-web' : 'deficheckup-web-staging',
        },
      );
      const commands = run.mock.calls.filter(([binary]) => binary !== 'git');
      expect(commands.map(([, args]) => args)).toEqual([
        ['check'],
        ['build'],
        ...['proxy', 'web'].map((packageName) => [
          'exec',
          'wrangler',
          'deploy',
          '--config',
          resolve(root, packageName, 'wrangler.jsonc'),
          '--env',
          environment === 'staging' ? 'staging' : '',
          '--name',
          `deficheckup-${packageName}${environment === 'staging' ? '-staging' : ''}`,
          '--env-file',
          resolve(root, 'scripts/empty-dev-vars'),
        ]),
      ]);
      for (const [, args, options] of commands.slice(2)) {
        expect(isAbsolute(args[args.indexOf('--config') + 1]!)).toBe(true);
        expect(isAbsolute(args[args.indexOf('--env-file') + 1]!)).toBe(true);
        expect(options.quiet).toBe(true);
        expect(options.env.WRANGLER_CI_OVERRIDE_NAME).toBeUndefined();
        const targetName = args[args.indexOf('--name') + 1]!;
        const config = parseWorkerSettings<ReturnType<typeof configured>>(
          readFileSync(args[args.indexOf('--config') + 1]!, 'utf8'),
        );
        expect(targetName).toBe(environment === 'staging' ? config.env.staging.name : config.name);
        expect(targetName.endsWith('-staging')).toBe(environment === 'staging');
      }
      for (const [, , options] of commands) {
        expect(options.env.DEFICHECKUP_ENV).toBe(environment);
        expect(options.env.PUBLIC_TURNSTILE_SITE_KEY).toBe(
          settings.turnstile[environment as 'staging' | 'production'].siteKey,
        );
        expect(options.env.PUBLIC_PROXY_URL).toBe(
          environment === 'staging' ? settings.stagingProxyUrl : 'https://api.deficheckup.com',
        );
        expect(options.env.CLOUDFLARE_ENV).toBe('');
        expect(options.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV).toBe('false');
      }
      expect(commands[2]![2].quiet).toBe(true);
      expect(commands[2]![2].cwd).toBe(resolve(root, 'proxy'));
    },
  );

  it('stops before deployment if a check or build audit fails', () => {
    for (const failed of ['check', 'build']) {
      const run = mockCommands();
      run.mockImplementation((binary, args) => {
        if (binary === 'pnpm' && args[0] === failed) throw new Error('Offline failure');
        return '';
      });
      expect(() => deploy(['staging'], settings, configured(), configuredWeb(), run, root)).toThrow(
        /Offline failure/,
      );
      expect(run.mock.calls.some(([, args]) => args.includes('wrangler'))).toBe(false);
    }
  });

  it('never deploys the web if the proxy deployment fails', () => {
    const run = mockCommands();
    run.mockImplementation((_binary, args) => {
      if (args.includes('wrangler')) throw new Error('Offline deployment failure');
      return '';
    });
    expect(() => deploy(['staging'], settings, configured(), configuredWeb(), run, root)).toThrow(
      /Offline deployment failure/,
    );
    expect(run.mock.calls.filter(([, args]) => args.includes('wrangler'))).toHaveLength(1);
  });

  it('rechecks the production tree after checks regenerate a tracked file', () => {
    let reads = 0;
    const run = mockCommands();
    run.mockImplementation((binary, args) =>
      binary === 'git'
        ? args[0] === 'branch'
          ? 'main'
          : ++reads === 1
            ? ''
            : ' M generated.ts'
        : '',
    );
    expect(() =>
      deploy(
        ['production', '--confirm-production'],
        settings,
        configured(),
        configuredWeb(),
        run,
        root,
      ),
    ).toThrow(/clean git tree/);
    expect(run.mock.calls.some(([, args]) => args.includes('wrangler'))).toBe(false);
  });
});
