import { appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { EVM_NETWORKS, type CatalogContract, type Check } from '../engine/src/index';
import { checks } from '../catalog/index';
import { deadlinesSoon, staleChecks, utcToday } from '../catalog/deadlines';

export const problemTitles = {
  stale: 'Catalog maintenance: stale verification',
  deadline: 'Catalog maintenance: deadline soon',
  code: 'Catalog maintenance: missing code',
} as const;
export const normalCheckCommands = [
  'typecheck',
  'lint',
  'format:check',
  'test',
  'guard',
  'build',
] as const;
export type ProblemType = keyof typeof problemTitles;
export type CodeState = 'present' | 'missing' | 'unavailable';
export type CodeResult = CatalogContract & { checkIds: string[]; state: CodeState };
export interface Problem {
  type: ProblemType;
  lines: string[];
}
export interface NormalCheck {
  name: string;
  passed: boolean;
}
export interface Report {
  today: string;
  checkCount: number;
  normalChecks: NormalCheck[];
  contracts: CodeResult[];
  problems: Problem[];
}

export function contractInventory(catalog: readonly Check[]) {
  const inventory = new Map<string, CatalogContract & { checkIds: string[] }>();
  for (const check of catalog) {
    for (const contract of check.contracts) {
      const key = `${contract.network}:${contract.network === 'solana' ? contract.address : contract.address.toLowerCase()}`;
      const item = inventory.get(key);
      if (item) {
        if (!item.checkIds.includes(check.id)) item.checkIds.push(check.id);
      } else inventory.set(key, { ...contract, checkIds: [check.id] });
    }
  }
  return [...inventory.values()];
}

/** RPC errors are unknown, never missing code or successful verification. No wallet checks run. */
export function createCodeReader(fetchFn: typeof fetch = fetch) {
  const chains = new Map<string, Promise<void>>();
  async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(3_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('RPC HTTP failure.');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('result' in body) || 'error' in body)
      throw new Error('Invalid RPC response.');
    return body.result;
  }
  return async (contract: CatalogContract): Promise<CodeState> => {
    if (contract.network === 'solana') {
      try {
        // Same public mainnet endpoint as the proxy's no-key fallback. No Helius key is needed.
        const result = await rpc('https://api.mainnet-beta.solana.com', 'getAccountInfo', [
          contract.address,
          { encoding: 'base64', commitment: 'finalized', dataSlice: { offset: 0, length: 0 } },
        ]);
        if (!result || typeof result !== 'object' || !('value' in result)) return 'unavailable';
        if (result.value === null) return 'missing';
        if (!result.value || typeof result.value !== 'object' || !('executable' in result.value))
          return 'unavailable';
        return result.value.executable === true
          ? 'present'
          : result.value.executable === false
            ? 'missing'
            : 'unavailable';
      } catch {
        return 'unavailable';
      }
    }
    const config = EVM_NETWORKS[contract.network];
    for (const url of config.rpcs) {
      try {
        let chain = chains.get(url);
        if (!chain) {
          chain = rpc(url, 'eth_chainId', []).then((id) => {
            if (
              typeof id !== 'string' ||
              !/^0x[0-9a-f]+$/i.test(id) ||
              BigInt(id) !== BigInt(config.chain.id)
            )
              throw new Error('Wrong RPC chain.');
          });
          chains.set(url, chain);
        }
        await chain;
        const code = await rpc(url, 'eth_getCode', [contract.address, 'latest']);
        if (typeof code !== 'string' || !/^0x(?:[0-9a-f]{2})*$/i.test(code))
          throw new Error('Invalid bytecode.');
        return code === '0x' ? 'missing' : 'present';
      } catch {
        /* Try the project's next public RPC. */
      }
    }
    return 'unavailable';
  };
}

export async function inspectContracts(
  catalog: readonly Check[],
  read: (contract: CatalogContract) => Promise<CodeState>,
) {
  const inventory = contractInventory(catalog);
  const results: CodeResult[] = [];
  let cursor = 0;
  // Bound provider load and keep one failing RPC from blocking the rest of the catalog.
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < inventory.length) {
        const item = inventory[cursor++]!;
        let state: CodeState;
        try {
          state = await read(item);
        } catch {
          state = 'unavailable';
        }
        results.push({ ...item, state });
      }
    }),
  );
  return results.sort(
    (a, b) => a.network.localeCompare(b.network) || a.address.localeCompare(b.address),
  );
}

export function makeReport(
  catalog: readonly Check[],
  today: string,
  contracts: CodeResult[],
  normalChecks: NormalCheck[] = [],
): Report {
  return {
    today,
    checkCount: catalog.length,
    contracts,
    normalChecks,
    problems: [
      {
        type: 'stale',
        lines: staleChecks(catalog, today).map(
          (check) =>
            `\`${check.id}\`: verified on ${check.verifiedOn}. Recheck contracts and the official link before updating the date.`,
        ),
      },
      {
        type: 'deadline',
        lines: deadlinesSoon(catalog, today).map(
          ({ check, deadline, days }) =>
            `\`${check.id}\`: ${deadline} (${days} UTC calendar days remaining). Review the official deadline and recovery guide.`,
        ),
      },
      {
        type: 'code',
        lines: contracts
          .filter(({ state }) => state !== 'present')
          .map(
            (item) =>
              `\`${item.checkIds.join(', ')}\`: ${item.network} \`${item.address}\`: ${item.state === 'missing' ? 'FAIL: missing code (or non-executable Solana program)' : 'FAIL: verification unavailable; RPC failed or returned invalid data'}.`,
          ),
      },
    ],
  };
}

export function renderReport(report: Report): string {
  const sections = report.problems.map(
    (problem) =>
      `## ${problemTitles[problem.type]}\n\n${problem.lines.length ? problem.lines.map((line) => `- ${line}`).join('\n') : 'None.'}`,
  );
  const failures = report.contracts.filter(({ state }) => state !== 'present');
  return `# Catalog maintenance: ${report.today} (UTC)\n\n${report.checkCount} checks; ${report.contracts.length} unique fixed contracts/programs; ${failures.length} code checks failed.\n\nCurrent code is read through the project's public RPCs (eth_getCode and Solana getAccountInfo), never wallet scans. Source verification in Sourcify alone does not prove code is still present today. API-only checks and dynamically discovered user accounts are outside this fixed inventory.\n\nDeadlines: today through day 30 inclusive. Stale: more than 60 UTC calendar days old. Dates do not refresh automatically.\n\n## Normal checks\n\n${report.normalChecks.length ? report.normalChecks.map(({ name, passed }) => `- ${passed ? 'PASS' : 'FAIL'}: ${name}`).join('\n') : 'Not run in this report.'}\n\n${sections.join('\n\n')}\n`;
}

export interface Issue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  body?: string | null;
  pull_request?: unknown;
}
export interface IssueAction {
  method: 'POST' | 'PATCH';
  number?: number;
  body: { title?: string; body?: string; state?: 'open' | 'closed' };
}

function issueBody(problem: Problem, today: string) {
  const prefix = `<!-- deficheckup-maintenance:${problem.type} -->\nUpdated ${today} (UTC). This issue is maintained by the weekly catalog job.\n\n`;
  const lines: string[] = [];
  let length = prefix.length;
  for (const line of problem.lines) {
    // GitHub issue bodies have a size limit. Preserve complete rows and addresses, never slice one.
    if (length + line.length + 3 > 60_000) break;
    lines.push(`- ${line}`);
    length += line.length + 3;
  }
  const omitted = problem.lines.length - lines.length;
  return `${prefix}${lines.join('\n')}${omitted ? `\n\n${omitted} additional rows are in the complete workflow job summary.` : ''}\n\nSee \`README.md#catalog-maintenance\` in this repository.`;
}

/** Exact titles are reserved for this job. Reuse closed issues and repair pre-existing duplicates. */
export function planIssues(
  problems: readonly Problem[],
  issues: readonly Issue[],
  today: string,
): IssueAction[] {
  const actions: IssueAction[] = [];
  for (const problem of problems) {
    const title = problemTitles[problem.type];
    const matches = issues
      .filter((issue) => !issue.pull_request && issue.title === title)
      .sort((a, b) => a.number - b.number);
    const primary = matches.find((issue) => issue.state === 'open') ?? matches[0];
    const body = issueBody(problem, today);
    if (problem.lines.length) {
      if (!primary) actions.push({ method: 'POST', body: { title, body } });
      else actions.push({ method: 'PATCH', number: primary.number, body: { body, state: 'open' } });
    }
    for (const issue of matches) {
      if (issue.state === 'open' && (!problem.lines.length || issue !== primary))
        actions.push({ method: 'PATCH', number: issue.number, body: { state: 'closed' } });
    }
  }
  return actions;
}

/** Fetch every page before mutating anything. A failed listing cannot create duplicate issues. */
export async function syncIssues(
  report: Report,
  repository: string,
  token: string,
  fetchFn: typeof fetch = fetch,
) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid repository.');
  const base = `https://api.github.com/repos/${repository}/issues`;
  async function request(url: string, method = 'GET', body?: unknown): Promise<unknown> {
    const response = await fetchFn(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`GitHub issue request failed (HTTP ${response.status}).`);
    return response.json();
  }
  const issues: Issue[] = [];
  for (let page = 1; ; page++) {
    const batch = await request(`${base}?state=all&per_page=100&page=${page}`);
    if (
      !Array.isArray(batch) ||
      batch.some(
        (issue: Issue) =>
          !issue ||
          !Number.isSafeInteger(issue.number) ||
          typeof issue.title !== 'string' ||
          !['open', 'closed'].includes(issue.state),
      )
    )
      throw new Error('Invalid GitHub issue listing.');
    issues.push(...(batch as Issue[]));
    if (batch.length < 100) break;
  }
  for (const action of planIssues(report.problems, issues, report.today))
    await request(action.number ? `${base}/${action.number}` : base, action.method, action.body);
}

async function normalChecks(): Promise<NormalCheck[]> {
  const results: NormalCheck[] = [];
  for (const name of normalCheckCommands) {
    const passed = await new Promise<boolean>((resolve) => {
      const env = { ...process.env };
      delete env.GITHUB_TOKEN;
      const child = spawn('pnpm', [name], { stdio: 'inherit', env });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
    results.push({ name, passed });
  }
  return results;
}

/** Preserve the report even when issue synchronization fails. Deadlines and stale dates are alerts. */
export async function publishReport(
  report: Report,
  writeSummary: (markdown: string) => Promise<void>,
  synchronize: (report: Report) => Promise<void>,
): Promise<boolean> {
  await writeSummary(renderReport(report));
  try {
    await synchronize(report);
  } catch (error) {
    await writeSummary(
      '\n## Issue synchronization failed\n\nThe report above is complete, but GitHub issues could not be synchronized. Inspect this failed run before retrying.\n',
    );
    throw error;
  }
  return (
    report.normalChecks.every(({ passed }) => passed) &&
    report.contracts.every(({ state }) => state === 'present')
  );
}

async function main() {
  // The CLI is deliberately restricted to the trusted default branch in Actions. Tests import it.
  const {
    GITHUB_ACTIONS,
    GITHUB_EVENT_NAME,
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
    GITHUB_STEP_SUMMARY,
    GITHUB_REF,
  } = process.env;
  if (
    GITHUB_ACTIONS !== 'true' ||
    !['schedule', 'workflow_dispatch'].includes(GITHUB_EVENT_NAME ?? '') ||
    GITHUB_REF !== 'refs/heads/main' ||
    !GITHUB_REPOSITORY ||
    !GITHUB_TOKEN ||
    !GITHUB_STEP_SUMMARY
  )
    throw new Error('Maintenance CLI requires a trusted Actions run on main.');
  const normal = await normalChecks();
  const today = utcToday(new Date());
  const contracts = await inspectContracts(checks, createCodeReader());
  const report = makeReport(checks, today, contracts, normal);
  const passed = await publishReport(
    report,
    (markdown) => appendFile(GITHUB_STEP_SUMMARY, markdown),
    (current) => syncIssues(current, GITHUB_REPOSITORY, GITHUB_TOKEN),
  );
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Never log a provider error, response body, environment or token.
    console.error('Catalog maintenance failed. Review the job summary and check logs.');
    process.exitCode = 1;
  });
}
