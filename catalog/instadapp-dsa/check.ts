import { evmContracts } from '../shared/contracts';
import { isEvmAddress, type Check } from '@deficheckup/engine';
import { readHoldings, type Holdings } from '../shared/holdings';
import { ETHEREUM_TOKENS } from '../shared/tokens';

// InstaList on Ethereum, read on-chain on 2026-11-01 (accounts() = 38195, instaIndex() =
// 0x2971AdFa57b20E5a416aE5a708A8655A9c74f723).
const INSTA_LIST = '0x4c8a1BEb8a87765788946D6B19C6C6355194AbEb';

// An owner's DSAs form a linked list: one read per DSA, one after another. The walk stops at a cap
// or after its share of the 10 s a check has, and then says the scan is incomplete instead of
// reporting nothing.
const MAX_DSAS = 25;
const WALK_BUDGET_MS = 4_000;

// Measured on 2026-11-01 with eth_estimateGas of cast(["BASIC-A"], [withdraw(...)]) from a DSA
// owner: 148,640 gas for a token and 69,819 for ETH, with an empty balance. A real balance writes
// two more storage slots, so the token figure is rounded up.
const WITHDRAW_GAS = { native: 70_000n, token: 170_000n };

const instaListAbi = [
  {
    type: 'function',
    name: 'userLink',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'first', type: 'uint64' },
      { name: 'last', type: 'uint64' },
      { name: 'count', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'userList',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'account', type: 'uint64' },
    ],
    outputs: [
      { name: 'prev', type: 'uint64' },
      { name: 'next', type: 'uint64' },
    ],
  },
  {
    type: 'function',
    name: 'accountAddr',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'uint64' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

function isBigints<T extends bigint[]>(value: unknown, length: T['length']): value is T {
  return (
    Array.isArray(value) && value.length === length && value.every((v) => typeof v === 'bigint')
  );
}

export const instadappDsaCheck: Check = {
  id: 'instadapp-dsa',
  name: 'Instadapp DSA',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://defi.instadapp.io',
  deadline: null,
  contracts: evmContracts('ethereum', INSTA_LIST, ...ETHEREUM_TOKENS.map((token) => token.address)),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }
    const started = Date.now();
    const read = (functionName: 'userLink' | 'userList' | 'accountAddr', args: unknown[]) =>
      ctx.readContract({
        network: 'ethereum',
        to: INSTA_LIST,
        abi: instaListAbi,
        functionName,
        args,
      });

    const link = await read('userLink', [address]);
    if (!isBigints<[bigint, bigint, bigint]>(link, 3)) {
      return { kind: 'error', reason: 'Unexpected response from InstaList.' };
    }
    const [first, , count] = link;
    if (count === 0n) return { kind: 'nothing' };

    // Each DSA's balances are read as soon as the DSA is known, while the walk goes on, so a long
    // or slow list does not push every balance read past the time limit.
    const ids: bigint[] = [];
    const scans: Promise<Holdings>[] = [];
    let id = first;
    let looped = false;
    while (id !== 0n && ids.length < MAX_DSAS && Date.now() - started < WALK_BUDGET_MS) {
      if (ids.includes(id)) {
        looped = true; // a broken list that points back: every DSA in it was already seen
        break;
      }
      ids.push(id);
      const [node, dsa] = await Promise.all([
        read('userList', [address, id]),
        read('accountAddr', [id]),
      ]);
      if (!isBigints<[bigint, bigint]>(node, 2) || typeof dsa !== 'string' || !isEvmAddress(dsa)) {
        return { kind: 'error', reason: 'Unexpected response from InstaList.' };
      }
      const number = id;
      scans.push(
        readHoldings(ctx, {
          network: 'ethereum',
          holder: dsa,
          tokens: ETHEREUM_TOKENS,
          native: { symbol: 'ETH', decimals: 18 },
          gas: WITHDRAW_GAS,
          title: (symbol) => `${symbol} in Instadapp DSA #${number}`,
        }),
      );
      id = node[1];
    }
    const complete = looped || (id === 0n && BigInt(ids.length) >= count);
    const results = await Promise.all(scans);

    const notes: string[] = [];
    if (results.some((r) => r.failed > 0)) {
      notes.push('Some balances of your Instadapp DSAs could not be read.');
    }
    if (!complete) {
      notes.push(`Only ${ids.length} of your ${count} Instadapp DSAs could be checked.`);
    }

    const [firstFinding, ...rest] = results.flatMap((r) => r.findings);
    if (firstFinding) {
      return {
        kind: 'found',
        findings: [firstFinding, ...rest],
        ...(notes.length > 0 ? { partial: notes.join(' ') } : {}),
      };
    }
    if (notes.length > 0) return { kind: 'error', reason: notes.join(' ') };
    return { kind: 'nothing' };
  },
};
