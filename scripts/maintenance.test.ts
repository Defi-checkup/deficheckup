import { describe, expect, it, vi } from 'vitest';
import { checks } from '../catalog/index';
import type { CatalogContract, Check } from '../engine/src/types';
import {
  contractInventory,
  createCodeReader,
  inspectContracts,
  makeReport,
  planIssues,
  problemTitles,
  publishReport,
  renderReport,
  syncIssues,
  type Issue,
  type Problem,
} from './maintenance';

const original = checks.find(({ id }) => id === 'safe-locking')!;
const contract = original.contracts[0]!;
const fixture = (overrides: Partial<Check> = {}): Check => ({
  ...original,
  contracts: [contract],
  ...overrides,
});
const json = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
const issue = (number: number, title: string, state: Issue['state'] = 'open'): Issue => ({
  number,
  title,
  state,
});
const emptyProblems = (): Problem[] =>
  Object.keys(problemTitles).map((type) => ({ type: type as Problem['type'], lines: [] }));

describe('fixed contract verification (offline RPC fixtures)', () => {
  it('includes all fixed contracts and implementations of the four M10 checks', () => {
    const inventory = contractInventory(checks);
    for (const id of [
      'liquity-surplus',
      'lido-withdrawals',
      'ribbon-v2',
      'immutable-withdrawals',
    ]) {
      const check = checks.find((check) => check.id === id)!;
      expect(check.contracts.length).toBeGreaterThan(1);
      for (const contract of check.contracts) {
        expect(
          inventory.find(
            (entry) =>
              entry.network === contract.network &&
              entry.address.toLowerCase() === contract.address.toLowerCase(),
          )?.checkIds,
        ).toContain(id);
      }
    }
  });
  it('includes each enabled M8 program in the weekly executable-code inventory', () => {
    const inventory = contractInventory(checks);
    for (const [checkId, address] of [
      ['meteora-dlmm', 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'],
      ['kamino-liquidity', '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc'],
      ['marginfi', 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA'],
      ['jupiter-lock', 'LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn'],
    ] as const) {
      expect(
        inventory.find((entry) => entry.network === 'solana' && entry.address === address)
          ?.checkIds,
      ).toContain(checkId);
    }
  });
  it('deduplicates by chain and address, retaining every dependent check ID', () => {
    const inventory = contractInventory([
      fixture(),
      fixture({
        id: 'second',
        contracts: [
          { network: 'ethereum', address: contract.address.toLowerCase() as `0x${string}` },
          { network: 'gnosis', address: contract.address as `0x${string}` },
        ],
      }),
    ]);
    expect(inventory).toHaveLength(2);
    expect(inventory[0]!.checkIds).toEqual([original.id, 'second']);
    expect(inventory[1]!.network).toBe('gnosis');
  });

  it('verifies the chain before reading code and caches only chain validation', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json('0x1'))
      .mockResolvedValueOnce(json('0x6000'))
      .mockResolvedValueOnce(json('0x00'));
    const read = createCodeReader(fetchFn);
    expect(await read(contract)).toBe('present');
    expect(await read(contract)).toBe('present');
    expect(fetchFn.mock.calls.map(([, init]) => JSON.parse(init!.body as string).method)).toEqual([
      'eth_chainId',
      'eth_getCode',
      'eth_getCode',
    ]);
    expect(JSON.parse(fetchFn.mock.calls[1]![1]!.body as string).params).toEqual([
      contract.address,
      'latest',
    ]);
    expect(fetchFn.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports empty code as missing without treating an all-zero instruction as empty', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json('0x1'))
      .mockResolvedValueOnce(json('0x'));
    expect(await createCodeReader(fetchFn)(contract)).toBe('missing');
  });

  it('tries configured fallback RPCs on an HTTP failure or wrong chain', async () => {
    for (const first of [new Response('', { status: 429 }), json('0x89')]) {
      const fetchFn = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(json('0x1'))
        .mockResolvedValueOnce(json('0x6000'));
      expect(await createCodeReader(fetchFn)(contract)).toBe('present');
      expect(fetchFn.mock.calls[0]![0]).not.toBe(fetchFn.mock.calls[1]![0]);
      expect(JSON.parse(fetchFn.mock.calls[1]![1]!.body as string).method).toBe('eth_chainId');
    }
  });

  it('reports timeouts, invalid data and JSON-RPC errors as unavailable, never empty code', async () => {
    for (const result of ['0x0', null, 'not-code', { code: '0x6000' }]) {
      const fetchFn = vi
        .fn<typeof fetch>()
        .mockImplementation(async (_url, init) =>
          JSON.parse(init!.body as string).method === 'eth_chainId' ? json('0x1') : json(result),
        );
      expect(await createCodeReader(fetchFn)(contract)).toBe('unavailable');
    }
    for (const response of [
      new Response(JSON.stringify({ error: { code: -1 } })),
      new Response('not JSON'),
    ]) {
      expect(
        await createCodeReader(
          vi.fn<typeof fetch>().mockImplementation(async () => response.clone()),
        )(contract),
      ).toBe('unavailable');
    }
    expect(
      await createCodeReader(vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout')))(
        contract,
      ),
    ).toBe('unavailable');
  });

  it('checks fixed Solana programs for existence and executability without enumerating wallets', async () => {
    const program = checks.find(({ id }) => id === 'solana-rent')!.contracts[0]!;
    for (const [value, state] of [
      [{ executable: true }, 'present'],
      [{ executable: false }, 'missing'],
      [null, 'missing'],
      [{}, 'unavailable'],
    ] as const) {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json({ value }));
      expect(await createCodeReader(fetchFn)(program)).toBe(state);
      const request = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string);
      expect(request.method).toBe('getAccountInfo');
      expect(request.params[0]).toBe(program.address);
      expect(request.params[1]).toMatchObject({
        commitment: 'finalized',
        dataSlice: { offset: 0, length: 0 },
      });
    }
  });

  it('continues after a failed read and bounds concurrency to four', async () => {
    const contracts = checks.flatMap((check) => check.contracts).slice(0, 9);
    let active = 0,
      peak = 0;
    const read = vi.fn(async (item: CatalogContract) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (item.address === contracts[0]!.address) throw new Error('provider error');
      return 'present' as const;
    });
    const result = await inspectContracts([fixture({ contracts })], read);
    expect(result).toHaveLength(contractInventory([fixture({ contracts })]).length);
    expect(peak).toBeLessThanOrEqual(4);
    expect(result.some(({ state }) => state === 'unavailable')).toBe(true);
    expect(result.some(({ state }) => state === 'present')).toBe(true);
  });
});

describe('maintenance report', () => {
  it('renders deterministic sections with no invented current problems', () => {
    const report = makeReport(
      [fixture()],
      '2026-11-02',
      [{ ...contract, checkIds: [original.id], state: 'present' }],
      [{ name: 'test', passed: true }],
    );
    const rendered = renderReport(report);
    expect(rendered).toContain('# Catalog maintenance: 2026-11-02 (UTC)');
    expect(rendered).toContain(
      '1 checks; 1 unique fixed contracts/programs; 0 code checks failed.',
    );
    expect(rendered).toContain('- PASS: test');
    for (const title of Object.values(problemTitles))
      expect(rendered).toContain(`## ${title}\n\nNone.`);
    expect(rendered).not.toMatch(/undefined|NaN/);
  });

  it('lists all three problem types with full contracts and separates missing from unknown', () => {
    const catalog = [fixture({ verifiedOn: '2026-09-01', deadline: '2026-11-02' })];
    const report = makeReport(
      catalog,
      '2026-11-02',
      [
        { ...contract, checkIds: [original.id], state: 'missing' },
        { ...original.contracts[1]!, checkIds: [original.id], state: 'unavailable' },
      ],
      [{ name: 'build', passed: false }],
    );
    const rendered = renderReport(report);
    expect(report.problems.every(({ lines }) => lines.length > 0)).toBe(true);
    expect(rendered).toContain('2026-11-02 (0 UTC calendar days remaining)');
    expect(rendered).toContain('verified on 2026-09-01');
    expect(rendered).toContain(`\`${contract.address}\`: FAIL: missing code`);
    expect(rendered).toContain('FAIL: verification unavailable');
    expect(rendered).toContain('- FAIL: build');
  });
});

describe('job outcome and summary persistence', () => {
  it('writes the summary before issue calls and preserves it when GitHub fails', async () => {
    const report = makeReport([fixture()], '2026-11-02', []);
    const writes: string[] = [];
    const write = vi.fn(async (markdown: string) => {
      writes.push(markdown);
    });
    const synchronize = vi.fn(async () => {
      expect(writes).toHaveLength(1);
      throw new Error('Synthetic API failure.');
    });
    await expect(publishReport(report, write, synchronize)).rejects.toThrow(
      'Synthetic API failure.',
    );
    expect(writes).toHaveLength(2);
    expect(writes[0]).toContain('# Catalog maintenance:');
    expect(writes[1]).toContain('Issue synchronization failed');
  });

  it('fails for absent or unverified code and normal check failures, while stale dates and deadlines stay alerts', async () => {
    const alerts = makeReport(
      [fixture({ verifiedOn: '2026-09-01', deadline: '2026-11-02' })],
      '2026-11-02',
      [],
    );
    const write = vi.fn<(markdown: string) => Promise<void>>().mockResolvedValue(undefined);
    const synchronize = vi.fn(async () => {});
    expect(await publishReport(alerts, write, synchronize)).toBe(true);
    for (const state of ['missing', 'unavailable'] as const) {
      const report = makeReport([fixture()], '2026-11-02', [
        { ...contract, checkIds: [original.id], state },
      ]);
      expect(await publishReport(report, write, synchronize)).toBe(false);
    }
    const failedNormal = makeReport(
      [fixture()],
      '2026-11-02',
      [],
      [{ name: 'test', passed: false }],
    );
    expect(await publishReport(failedNormal, write, synchronize)).toBe(false);
    expect(synchronize).toHaveBeenCalledTimes(4);
  });
});

describe('issue reconciliation', () => {
  it('creates at most one issue for each type and updates it on repeat runs', () => {
    const problems = emptyProblems().map((problem) => ({
      ...problem,
      lines: ['Review this fixture.'],
    }));
    const created = planIssues(problems, [], '2026-11-02');
    expect(created).toHaveLength(3);
    expect(created.every(({ method }) => method === 'POST')).toBe(true);
    const issues = created.map(({ body }, index) => issue(index + 1, body.title!));
    const repeated = planIssues(problems, issues, '2026-11-09');
    expect(repeated).toHaveLength(3);
    expect(repeated.every(({ method, body }) => method === 'PATCH' && body.state === 'open')).toBe(
      true,
    );
    expect(repeated[0]!.body.body).toContain('Updated 2026-11-09 (UTC)');
  });

  it('bounds oversized issue bodies on complete rows and retains the full report in the summary', () => {
    const lines = Array.from(
      { length: 1000 },
      () => `ethereum: ${contract.address}: ${'Provider unavailable. '.repeat(5)}`,
    );
    const report = makeReport([fixture()], '2026-11-02', []);
    report.problems = [{ type: 'code', lines }];
    const body = planIssues(report.problems, [], report.today)[0]!.body.body!;
    expect(body.length).toBeLessThan(65_536);
    expect(body).toContain('additional rows are in the complete workflow job summary');
    for (const row of body.split('\n').filter((line) => line.startsWith('- ')))
      expect(row).toBe(`- ${lines[0]}`);
    expect(renderReport(report).split(lines[0]!).length - 1).toBe(1000);
  });

  it('closes resolved problems and reopens the same issue when they return', () => {
    const problems = emptyProblems();
    const existing = [issue(7, problemTitles.stale)];
    expect(planIssues(problems, existing, '2026-11-02')).toEqual([
      { method: 'PATCH', number: 7, body: { state: 'closed' } },
    ]);
    problems[0]!.lines = ['Review again.'];
    const reopened = planIssues(problems, [{ ...existing[0]!, state: 'closed' }], '2026-11-09');
    expect(reopened).toMatchObject([{ method: 'PATCH', number: 7, body: { state: 'open' } }]);
  });

  it('repairs duplicates and ignores pull requests and unrelated issues', () => {
    const problems = emptyProblems();
    problems[0]!.lines = ['Review.'];
    const existing = [
      issue(8, problemTitles.stale),
      issue(4, problemTitles.stale),
      issue(1, problemTitles.stale, 'closed'),
      issue(2, 'Unrelated'),
      { ...issue(3, problemTitles.stale), pull_request: {} },
    ];
    const actions = planIssues(problems, existing, '2026-11-02');
    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({ number: 4, method: 'PATCH', body: { state: 'open' } });
    expect(actions[1]).toEqual({ number: 8, method: 'PATCH', body: { state: 'closed' } });
    expect(planIssues(emptyProblems(), existing, '2026-11-02').map(({ number }) => number)).toEqual(
      [4, 8],
    );
  });

  it('paginates open and closed issues before writing and updates a match on page two', async () => {
    const report = makeReport([fixture({ verifiedOn: '2026-09-01' })], '2026-11-02', []);
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(Array.from({ length: 100 }, (_, i) => issue(i + 1, `Other ${i}`))),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([issue(101, problemTitles.stale, 'closed')])),
      )
      .mockResolvedValueOnce(new Response('{}'));
    await syncIssues(report, 'example/repo', 'synthetic-token', fetchFn);
    expect(fetchFn.mock.calls).toHaveLength(3);
    expect(fetchFn.mock.calls[0]![0]).toContain('state=all&per_page=100&page=1');
    expect(fetchFn.mock.calls[1]![0]).toContain('page=2');
    expect(fetchFn.mock.calls[2]![0]).toBe('https://api.github.com/repos/example/repo/issues/101');
    expect(fetchFn.mock.calls[2]![1]!.method).toBe('PATCH');
    expect(JSON.parse(fetchFn.mock.calls[2]![1]!.body as string).state).toBe('open');
  });

  it('fails without writes on an unreadable listing, and rejects API write errors', async () => {
    const report = makeReport([fixture({ verifiedOn: '2026-09-01' })], '2026-11-02', []);
    for (const response of [
      new Response('{}'),
      new Response('', { status: 403 }),
      new Response(JSON.stringify([{}])),
    ]) {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        syncIssues(report, 'example/repo', 'synthetic-token', fetchFn),
      ).rejects.toThrow();
      expect(fetchFn.mock.calls).toHaveLength(1);
    }
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('[]'))
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(syncIssues(report, 'example/repo', 'synthetic-token', fetchFn)).rejects.toThrow(
      'HTTP 403',
    );
    expect(fetchFn.mock.calls[1]![1]!.method).toBe('POST');
  });
});
