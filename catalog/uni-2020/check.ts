import { evmContracts } from '../shared/contracts';
import {
  lookupPrice,
  valueAtPrice,
  distributorLeaf,
  isEvmAddress,
  isHash32,
  verifyMerkleProof,
  type Check,
  type Hash32,
} from '@deficheckup/engine';

// Uniswap's MerkleDistributor for the September 2020 UNI airdrop, read on-chain on 2026-11-01:
// token() is UNI, merkleRoot() below, and the source (Sourcify) has no deadline and no sweep, so an
// unclaimed entry stays claimable while the contract holds UNI. It held 257,005 UNI that day, down
// from 12.5M on 2026-10-04: since about 2026-10-18 one address claims in batches on behalf of each
// eligible wallet (the UNI goes to the wallet, not to the caller).
const DISTRIBUTOR = '0x090D4613473dEE047c3f2706764f49E0821D256e';
const UNI = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
const ROOT: Hash32 = '0xc8500f8e2fcf3c9a32880e1b973fb28acc88be35787a8abcf9981b2b65dbdeb5';

// Uniswap's published tree, pinned to the last commit (2021-05-24) so the files cannot change under
// us: mapping.json (225 KB) maps the first address of each chunk to its last, and each chunk holds
// 101 entries (~140 KB). raw.githubusercontent.com answers browsers (CORS open). Every proof is
// checked against ROOT, so a changed file gives an error, never a wrong finding.
const DATA =
  'https://raw.githubusercontent.com/Uniswap/mrkl-drop-data-chunks/c215bf1e4360205acdc6c154389b10a2f287974d/chunks/';

// Measured on 2026-11-01 from the gasUsed of a real single claim: 83,345 in
// 0xd9a1987ac8a7beaaf37a9c2c028a22b7ac1e9225f1f180ac0e91bbc0eead7d10.
const CLAIM_GAS = 84_000n;

const ZERO = '0x0000000000000000000000000000000000000000';

const distributorAbi = [
  {
    type: 'function',
    name: 'isClaimed',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface Entry {
  index: number;
  amount: bigint;
  proof: Hash32[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ADDRESS = /^0x[0-9a-f]{40}$/;

/**
 * First address of the chunk that would hold `address` (lowercase), null when none does, or
 * undefined when the mapping is not a sane list of ranges. An empty or broken mapping must never
 * read as "not eligible".
 */
function findChunk(mapping: Record<string, unknown>, address: string): string | null | undefined {
  const ranges = Object.entries(mapping);
  if (ranges.length === 0) return undefined;
  let previous = '';
  let found: string | null = null;
  for (const [first, last] of ranges) {
    if (typeof last !== 'string') return undefined;
    const [from, to] = [first.toLowerCase(), last.toLowerCase()];
    if (!ADDRESS.test(from) || !ADDRESS.test(to) || from > to || from <= previous) return undefined;
    previous = to;
    if (from <= address && address <= to) found = first;
  }
  return found;
}

function parseEntry(value: unknown): Entry | null {
  if (!isRecord(value)) return null;
  const { index, amount, proof } = value;
  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) return null;
  if (typeof amount !== 'string' || !/^0x[0-9a-fA-F]+$/.test(amount)) return null;
  if (!Array.isArray(proof) || !proof.every(isHash32)) return null;
  return { index, amount: BigInt(amount), proof };
}

/**
 * A chunk is trusted when it starts at `first`, stays inside its range and every entry's proof
 * matches the on-chain root. Only then does "your address is not in it" mean "not eligible".
 */
function isTrustedChunk(chunk: Record<string, unknown>, first: string, last: string): boolean {
  const [from, to] = [first.toLowerCase(), last.toLowerCase()];
  const keys = Object.keys(chunk);
  if (!keys.some((key) => key.toLowerCase() === from)) return false;
  return keys.every((key) => {
    const lower = key.toLowerCase();
    if (!ADDRESS.test(lower) || lower < from || lower > to) return false;
    const entry = parseEntry(chunk[key]);
    if (entry === null) return false;
    const leaf = distributorLeaf(BigInt(entry.index), lower as `0x${string}`, entry.amount);
    return verifyMerkleProof(leaf, entry.proof, ROOT);
  });
}

export const uni2020Check: Check = {
  id: 'uni-2020',
  name: 'Uniswap UNI airdrop (2020)',
  networks: ['ethereum'],
  category: 'unclaimed-airdrop',
  status: { kind: 'open' },
  officialLink: 'https://blog.uniswap.org/uni',
  deadline: null,
  contracts: evmContracts('ethereum', DISTRIBUTOR, UNI),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }
    const lower = address.toLowerCase();

    let mapping: unknown;
    try {
      mapping = await ctx.fetchJson(`${DATA}mapping.json`);
    } catch {
      return { kind: 'error', reason: "Could not load Uniswap's airdrop list." };
    }
    if (!isRecord(mapping)) {
      return { kind: 'error', reason: "Unexpected format in Uniswap's airdrop list." };
    }
    const first = findChunk(mapping, lower);
    if (first === undefined) {
      return { kind: 'error', reason: "Unexpected format in Uniswap's airdrop list." };
    }
    if (first === null) return { kind: 'nothing' };

    let chunk: unknown;
    try {
      chunk = await ctx.fetchJson(`${DATA}${first}.json`);
    } catch {
      return { kind: 'error', reason: "Could not load Uniswap's airdrop list." };
    }
    if (!isRecord(chunk) || !isTrustedChunk(chunk, first, mapping[first] as string)) {
      return { kind: 'error', reason: "Unexpected format in Uniswap's airdrop list." };
    }
    const key = Object.keys(chunk).find((k) => k.toLowerCase() === lower);
    if (key === undefined) return { kind: 'nothing' };

    const entry = parseEntry(chunk[key]);
    if (entry === null) {
      return { kind: 'error', reason: "Unexpected format in Uniswap's airdrop list." };
    }
    const leaf = distributorLeaf(BigInt(entry.index), address, entry.amount);
    if (!verifyMerkleProof(leaf, entry.proof, ROOT)) {
      return {
        kind: 'error',
        reason: "Uniswap's airdrop list does not match the contract, so it was not trusted.",
      };
    }

    const [claimed, left] = await Promise.all([
      ctx.readContract({
        network: 'ethereum',
        to: DISTRIBUTOR,
        abi: distributorAbi,
        functionName: 'isClaimed',
        args: [BigInt(entry.index)],
      }),
      ctx.readContract({
        network: 'ethereum',
        to: UNI,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [DISTRIBUTOR],
      }),
    ]);
    if (typeof claimed !== 'boolean' || typeof left !== 'bigint') {
      return { kind: 'error', reason: 'Unexpected response from the Uniswap distributor.' };
    }
    if (claimed) return { kind: 'nothing', alreadyClaimed: true };

    // UNI refuses transfers to the zero address, so its entry can never be paid.
    if (lower === ZERO) {
      return { kind: 'lost', reason: 'UNI cannot be sent to the zero address.' };
    }
    if (left < entry.amount) {
      return {
        kind: 'lost',
        reason: "Uniswap's distributor no longer holds enough UNI to pay this claim.",
      };
    }

    const amount = { raw: entry.amount, decimals: 18, symbol: 'UNI' };
    const [price, claimCostUsd] = await Promise.all([
      lookupPrice(ctx, 'ethereum', UNI),
      ctx.gasCostUsd('ethereum', CLAIM_GAS),
    ]);

    return {
      kind: 'found',
      findings: [
        {
          title: 'UNI from the 2020 Uniswap airdrop, never claimed',
          network: 'ethereum',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: null,
          heldBy: DISTRIBUTOR,
          note: 'Anyone can send this claim and the UNI always goes to your wallet. Since October 2026 another address claims these in batches, so it may arrive before you claim it.',
        },
      ],
    };
  },
};
