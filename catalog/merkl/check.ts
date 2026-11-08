import {
  EVM_NETWORKS,
  amountToNumber,
  isEvmAddress,
  type Check,
  type EvmNetwork,
  type Finding,
} from '@deficheckup/engine';

// Merkl's public API. Checked on 2026-11-01: it answers browsers (it echoes the page's origin in
// access-control-allow-origin) and returns every chain asked for in one request. On Ethereum the
// root it reports matched the Distributor's tree() on-chain.
const REWARDS_API = 'https://api.merkl.xyz/v4/users';

// Measured on 2026-11-01 with eth_estimateGas of Distributor.claim() for one token with a 20-step
// proof, from a public recipient on Ethereum: 142,392 gas. Longer proofs cost a little more.
const CLAIM_GAS = 145_000n;

/** Balances worth less than this (when a price is known) are noise, not forgotten funds. */
const DUST_USD = 0.01;

// On 2026-11-02 the API started rejecting the whole request with 400 "Chain 81457 not supported"
// (Blast), which failed the check for every wallet. Networks Merkl does not serve stay out.
const UNSUPPORTED: readonly EvmNetwork[] = ['blast'];

const NETWORK_BY_CHAIN_ID = new Map<number, EvmNetwork>(
  (Object.entries(EVM_NETWORKS) as [EvmNetwork, (typeof EVM_NETWORKS)[EvmNetwork]][])
    .filter(([network]) => !UNSUPPORTED.includes(network))
    .map(([network, config]) => [config.chain.id, network]),
);
const CHAIN_IDS = [...NETWORK_BY_CHAIN_ID.keys()].join(',');

interface MerklReward {
  amount?: string;
  claimed?: string;
  token?: { address?: string; decimals?: number; symbol?: string; price?: number | null };
}
interface MerklChain {
  chain?: { id?: number };
  rewards?: MerklReward[];
}

function toBigInt(value: string | undefined): bigint | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
}

export const merklCheck: Check = {
  id: 'merkl',
  name: 'Merkl rewards',
  networks: [...NETWORK_BY_CHAIN_ID.values()],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.merkl.xyz',
  deadline: null,
  // API-only check: reward token contracts are discovered per user, never enumerated here.
  contracts: [],
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const answer = await ctx
      .fetchJson(`${REWARDS_API}/${address}/rewards?chainId=${CHAIN_IDS}`)
      .catch(() => undefined);
    if (!Array.isArray(answer)) {
      return { kind: 'error', reason: 'Merkl rewards could not be read.' };
    }

    const unclaimed: { network: EvmNetwork; reward: MerklReward; raw: bigint }[] = [];
    let unreadable = 0;
    const failedNetworks = new Set<EvmNetwork>();
    let unknownNetwork = false;
    for (const entry of answer as MerklChain[]) {
      const network = NETWORK_BY_CHAIN_ID.get(entry.chain?.id ?? -1);
      if (!network || !Array.isArray(entry.rewards)) {
        // An explicitly unsupported chain is outside our coverage; malformed data is a failure.
        if (!network && Number.isSafeInteger(entry.chain?.id)) continue;
        unreadable++;
        if (network) failedNetworks.add(network);
        else unknownNetwork = true;
        continue;
      }
      for (const reward of entry.rewards) {
        const amount = toBigInt(reward.amount);
        const claimed = toBigInt(reward.claimed);
        if (
          amount === null ||
          claimed === null ||
          claimed > amount ||
          typeof reward.token?.symbol !== 'string' ||
          !reward.token.symbol.trim() ||
          !Number.isSafeInteger(reward.token.decimals) ||
          reward.token.decimals! < 0 ||
          reward.token.decimals! > 36
        ) {
          unreadable++;
          failedNetworks.add(network);
          continue;
        }
        // amount is everything earned so far; what was already claimed comes off.
        if (amount > claimed) unclaimed.push({ network, reward, raw: amount - claimed });
      }
    }

    const findings = await Promise.all(
      unclaimed.map(async ({ network, reward, raw }): Promise<Finding> => {
        const amount = { raw, decimals: reward.token!.decimals!, symbol: reward.token!.symbol! };
        const price = reward.token?.price;
        return {
          title: `${amount.symbol} rewards from Merkl`,
          network,
          amount,
          valueUsd:
            typeof price === 'number' && Number.isFinite(price) && price > 0
              ? amountToNumber(amount) * price
              : null,
          claimCostUsd: await ctx.gasCostUsd(network, CLAIM_GAS),
          deadline: null,
        };
      }),
    );

    const kept = findings.filter((f) => f.valueUsd === null || f.valueUsd >= DUST_USD);
    // An incomplete list would incorrectly imply that every unlisted network finished.
    const failures = unknownNetwork ? {} : { failedNetworks: [...failedNetworks] };
    const [first, ...rest] = kept;
    if (first) {
      return {
        kind: 'found',
        findings: [first, ...rest],
        ...(unreadable > 0
          ? { partial: 'Some Merkl rewards could not be read.', ...failures }
          : {}),
      };
    }
    if (unreadable > 0) {
      return { kind: 'error', reason: 'Some Merkl rewards could not be read.', ...failures };
    }
    return { kind: 'nothing' };
  },
};
