import type {
  CheckRun,
  CheckFinding,
  CheckOutcome,
  Network,
  TokenAmount,
} from '@deficheckup/engine';
import type { CheckInfo } from './catalog';
import { checksForAddress } from './catalog';

type Finished = Pick<CheckRun, 'checkId' | 'address' | 'outcome'>;

export function isIncomplete(outcome: CheckOutcome): boolean {
  return outcome.kind === 'error' || (outcome.kind === 'found' && Boolean(outcome.partial));
}

/** A protocol-wide failure is not evidence that every network it covers failed. */
export function failedNetworksFor(check: CheckInfo, outcome: CheckOutcome): readonly Network[] {
  if (!isIncomplete(outcome)) return [];
  if (check.networks.length === 1) return check.networks;
  return 'failedNetworks' in outcome
    ? (outcome.failedNetworks ?? []).filter((network) => check.networks.includes(network))
    : [];
}

/** Coverage combines only the checks applicable to the selected wallets. */
export function networkCoverage(
  network: Network,
  checks: readonly CheckInfo[],
  runs: readonly Finished[],
  addresses: readonly string[],
  scanning = false,
) {
  const applicable = checks.filter((check) => check.networks.includes(network));
  const completed = runs.filter(
    (run) =>
      addresses.includes(run.address) && applicable.some((check) => check.id === run.checkId),
  );
  const findings = completed.flatMap((run) =>
    run.outcome.kind === 'found'
      ? run.outcome.findings.filter((finding) => finding.network === network)
      : [],
  );
  const expected = addresses.reduce(
    (count, address) => count + checksForAddress(applicable, address).length,
    0,
  );
  const pending = completed.length < expected;
  const failed = completed.some((run) =>
    failedNetworksFor(
      applicable.find((check) => check.id === run.checkId)!,
      run.outcome,
    ).includes(network),
  );
  const checked = completed.some(({ outcome }) => {
    if (!isIncomplete(outcome)) return true;
    // Named failures leave the other networks complete, even if the overall outcome is an error.
    if ('failedNetworks' in outcome && outcome.failedNetworks) {
      return !outcome.failedNetworks.includes(network);
    }
    return (
      outcome.kind === 'found' && outcome.findings.some((finding) => finding.network === network)
    );
  });
  return {
    findings,
    pending,
    status: pending
      ? scanning
        ? 'checking'
        : 'not checked'
      : failed
        ? 'incomplete'
        : checked
          ? 'checked'
          : 'not checked',
  };
}

export interface FailedCheck {
  check: CheckInfo;
  run: CheckRun;
}

/** Called for one wallet: a network notice requires an attributed error from every expected check. */
export function groupedFailures(checks: readonly CheckInfo[], runs: readonly CheckRun[]) {
  const failures: FailedCheck[] = runs
    .filter((run) => isIncomplete(run.outcome))
    .map((run) => ({
      check: checks.find((check) => check.id === run.checkId)!,
      run,
    }));
  const networks = [...new Set(checks.flatMap((check) => check.networks))];
  const groups = networks.flatMap((network) => {
    const applicable = checks.filter((check) => check.networks.includes(network));
    const entries = failures.filter(
      ({ check, run }) =>
        run.outcome.kind === 'error' && failedNetworksFor(check, run.outcome).includes(network),
    );
    return applicable.every((check) => entries.some((entry) => entry.check.id === check.id))
      ? [{ network, entries }]
      : [];
  });
  const grouped = new Set(groups.map((group) => group.network));
  const individual = failures.filter(({ check, run }) => {
    if (run.outcome.kind !== 'error') return true;
    const networks = failedNetworksFor(check, run.outcome);
    return networks.length === 0 || networks.some((network) => !grouped.has(network));
  });
  return { groups, individual };
}

/** Establish network failures per wallet before combining notices across the scan. */
export function groupedScanFailures(checks: readonly CheckInfo[], runs: readonly CheckRun[]) {
  const groups = new Map<Network, FailedCheck[]>();
  const individual = new Map<string, FailedCheck[]>();
  for (const address of new Set(runs.map((run) => run.address))) {
    const failures = groupedFailures(
      checksForAddress(checks, address),
      runs.filter((run) => run.address === address),
    );
    for (const group of failures.groups) {
      groups.set(group.network, [...(groups.get(group.network) ?? []), ...group.entries]);
    }
    for (const entry of failures.individual) {
      const entries = individual.get(entry.check.id) ?? [];
      entries.push(entry);
      individual.set(entry.check.id, entries);
    }
  }
  return {
    groups: [...groups].map(([network, entries]) => ({ network, entries })),
    individual: [...individual.values()],
  };
}

/** User-facing scope, independent of internal RPC, decoding or contract failure messages. */
export const failureSubjects: Record<string, string> = {
  'liquity-surplus': 'ETH left after a Liquity V1 liquidation or redemption',
  'lido-withdrawals': 'ETH waiting to be claimed from Lido withdrawals',
  'ribbon-v2': 'your Ribbon vault balances and withdrawals',
  'immutable-withdrawals': 'your pending Immutable X withdrawals',
  'jupiter-lock': 'tokens waiting to be claimed from Jupiter Lock',
  'instadapp-dsa': 'balances in your Instadapp smart wallets',
  dsproxy: 'balances in your Maker and DeFi Saver smart wallets',
  'giv-tokendistro': 'your unclaimed Giveth rewards',
  'aave-v2-rewards': 'your unclaimed Aave V2 rewards',
  hyperliquid: 'your Hyperliquid balances',
  merkl: 'your unclaimed Merkl rewards',
  'safe-owner': 'your Safe balances and ownership',
  'compound-v2': 'your Compound V2 deposits and rewards',
  cream: 'your Cream deposits',
  'koi-fees': 'your unclaimed Koi pool fees',
  'koi-lp': 'your Koi liquidity pool balances',
  'koi-amplifier': 'your tokens staked in Mute Amplifiers',
  'koi-farm': 'your Koi farm balances and rewards',
  'safe-locking': 'your locked SAFE tokens',
  'uni-2020': 'your unclaimed 2020 UNI airdrop',
  'zksync-lite': 'your remaining zkSync Lite balances',
  'kitty-loot-farm': 'your tokens staked in KittyPunch farms',
  'solana-stake': 'SOL you may be able to withdraw from staking',
  'solana-rent': 'SOL you may be able to recover from empty token accounts',
  'meteora-dlmm': 'your Meteora liquidity positions and refundable SOL',
  'kamino-liquidity': 'your Kamino liquidity balances',
  marginfi: 'your marginfi deposits',
};

export function failureMessage(check: CheckInfo, outcome: CheckOutcome): string {
  const subject = failureSubjects[check.id] ?? `balances in ${check.name}`;
  return outcome.kind === 'found'
    ? `We could not finish checking ${subject}, so there may be more funds there.`
    : `We could not check ${subject}, so there may be funds there.`;
}

export function failureReason(outcome: CheckOutcome): string {
  return outcome.kind === 'error'
    ? outcome.reason
    : outcome.kind === 'found'
      ? (outcome.partial ?? '')
      : '';
}

export { MAX_WALLETS, splitInputs } from './inputs';
export const VISIBLE_FINDINGS = 3;
/** Short card labels; the original position title remains in Details. */
export const positionLabels: Record<string, string> = {
  'instadapp-dsa': 'Smart wallet balance',
  dsproxy: 'Smart wallet balance',
  'giv-tokendistro': 'Vested rewards',
  'aave-v2-rewards': 'Unclaimed rewards',
  hyperliquid: 'Account balance',
  merkl: 'Unclaimed rewards',
  'safe-owner': 'Safe balance',
  'compound-v2': 'Supplied balance',
  'koi-fees': 'Unclaimed fees',
  'safe-locking': 'Token lock',
  'uni-2020': '2020 airdrop',
  'koi-lp': 'Liquidity balance',
  'koi-amplifier': 'Staked liquidity',
  'koi-farm': 'Staked liquidity',
  'zksync-lite': 'Shutdown balance',
  'solana-stake': 'Withdrawable stake',
  'solana-rent': 'Account rent',
  'meteora-dlmm': 'Liquidity or rent',
  'kamino-liquidity': 'Strategy shares',
  marginfi: 'Asset shares',
  'jupiter-lock': 'Funded escrow',
  'lido-withdrawals': 'Finalized withdrawal',
  'liquity-surplus': 'Collateral surplus',
  'immutable-withdrawals': 'Pending withdrawal',
  'ribbon-v2': 'Vault position',
  'kitty-loot-farm': 'Staked balance',
};

/** Keep token amounts exact, including balances smaller than a display precision. */
export function tokenAmount(amount: TokenAmount | null): string {
  if (amount === null) return 'Amount unavailable';
  const negative = amount.raw < 0n;
  const digits = (negative ? -amount.raw : amount.raw)
    .toString()
    .padStart(amount.decimals + 1, '0');
  const whole = amount.decimals ? digits.slice(0, -amount.decimals) : digits;
  const fraction = amount.decimals ? digits.slice(-amount.decimals).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''} ${amount.symbol}`;
}

/** Truncate integer units before formatting: six significant digits, never an inflated balance. */
export function displayTokenAmount(amount: TokenAmount | null): string {
  if (amount === null) return 'Amount unavailable';
  if (amount.raw > 0n && amount.raw * 10000n < 10n ** BigInt(amount.decimals))
    return `< 0.0001 ${amount.symbol}`;
  const magnitude = (amount.raw < 0n ? -amount.raw : amount.raw).toString().length;
  const step = 10n ** BigInt(Math.max(0, magnitude - 6));
  // BigInt division truncates toward zero. Floor negatives too, so display never exceeds raw.
  const raw =
    amount.raw < 0n ? ((amount.raw - step + 1n) / step) * step : (amount.raw / step) * step;
  const exact = tokenAmount({ ...amount, raw });
  const number = exact.slice(0, -(amount.symbol.length + 1));
  const [whole, fraction] = number.split('.');
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''} ${amount.symbol}`;
}

export interface FindingGroup {
  address: string;
  checkId: string;
  findings: CheckFinding[];
  valueUsd: number | null;
  unpriced: number;
  pricesUnavailable: number;
}

export function priceUnavailable(finding: CheckFinding): boolean {
  return finding.valueUsd === null && finding.priceStatus === 'unavailable';
}

/** Keep separate token quantities, rather than adding unrelated assets into a headline. */
export function tokenHeadline(findings: readonly CheckFinding[]): string {
  return findings.map((finding) => displayTokenAmount(finding.amount)).join(' · ');
}

/**
 * One card per wallet and check. The priced collection also keeps price outages visible;
 * only groups whose prices are all unknown belong in the unpriced fold.
 */
export function groupedFindings(runs: readonly CheckRun[]) {
  const wallets = new Map<string, Map<string, FindingGroup>>();
  for (const { address, checkId, outcome } of runs) {
    if (outcome.kind !== 'found') continue;
    let checks = wallets.get(address);
    if (!checks) wallets.set(address, (checks = new Map()));
    let group = checks.get(checkId);
    if (!group) {
      group = { address, checkId, findings: [], valueUsd: null, unpriced: 0, pricesUnavailable: 0 };
      checks.set(checkId, group);
    }
    for (const finding of outcome.findings) {
      group.findings.push(finding);
      if (priceUnavailable(finding)) group.pricesUnavailable++;
      else if (finding.valueUsd === null) group.unpriced++;
      else group.valueUsd = (group.valueUsd ?? 0) + finding.valueUsd;
    }
  }
  const groups = [...wallets.values()].flatMap((checks) => [...checks.values()]);
  return {
    priced: groups
      .filter((group) => group.valueUsd !== null || group.pricesUnavailable > 0)
      .sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1)),
    unpriced: groups.filter((group) => group.valueUsd === null && !group.pricesUnavailable),
  };
}

export interface ProtocolFindingGroup extends Omit<FindingGroup, 'address'> {
  wallets: { address: string; findings: CheckFinding[]; notices: string[] }[];
  amount: TokenAmount | null;
}

/** Only like units on the same network can be safely added with the catalog's token metadata. */
function combinedAmount(checkId: string, findings: readonly CheckFinding[]): TokenAmount | null {
  // Different Kamino strategy mints share a generic label and may have identical decimals.
  if (checkId === 'kamino-liquidity' && findings.length > 1) return null;
  const first = findings[0];
  if (!first?.amount) return null;
  const { symbol, decimals } = first.amount;
  if (
    findings.some(
      (finding) =>
        finding.network !== first.network ||
        finding.amount?.symbol !== symbol ||
        finding.amount.decimals !== decimals,
    )
  )
    return null;
  return {
    symbol,
    decimals,
    raw: findings.reduce((sum, finding) => sum + finding.amount!.raw, 0n),
  };
}

/** One card per protocol check, preserving every wallet and position within it. */
export function groupedProtocolFindings(runs: readonly CheckRun[]) {
  const groups = new Map<string, ProtocolFindingGroup>();
  for (const { address, checkId, outcome } of runs) {
    if (outcome.kind !== 'found') continue;
    let group = groups.get(checkId);
    if (!group) {
      group = {
        checkId,
        findings: [],
        wallets: [],
        valueUsd: null,
        unpriced: 0,
        pricesUnavailable: 0,
        amount: null,
      };
      groups.set(checkId, group);
    }
    let wallet = group.wallets.find((wallet) => wallet.address === address);
    if (!wallet) {
      wallet = { address, findings: [], notices: [] };
      group.wallets.push(wallet);
    }
    wallet.notices.push(...(outcome.notices ?? []));
    for (const finding of outcome.findings) {
      wallet.findings.push(finding);
      group.findings.push(finding);
      if (priceUnavailable(finding)) group.pricesUnavailable++;
      else if (finding.valueUsd === null) group.unpriced++;
      else group.valueUsd = (group.valueUsd ?? 0) + finding.valueUsd;
    }
  }
  for (const group of groups.values()) group.amount = combinedAmount(group.checkId, group.findings);
  return {
    priced: [...groups.values()]
      .filter((group) => group.valueUsd !== null || group.pricesUnavailable > 0)
      .sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1)),
    unpriced: [...groups.values()].filter(
      (group) => group.valueUsd === null && !group.pricesUnavailable,
    ),
  };
}

/** Estimates always round down, never up. Unknown prices stay unknown. */
export function usd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'USD estimate unavailable';
  if (value > 0 && value < 0.01) return '≈ < $0.01';
  return `≈ $${(Math.floor(value * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function findingsIn(runs: readonly CheckRun[]): CheckFinding[] {
  return runs.flatMap(({ outcome }) => (outcome.kind === 'found' ? outcome.findings : []));
}

export function totals(runs: readonly CheckRun[]) {
  const findings = findingsIn(runs);
  return {
    count: findings.length,
    knownUsd: findings.reduce((sum, finding) => sum + (finding.valueUsd ?? 0), 0),
    unpriced: findings.filter((finding) => finding.valueUsd === null && !priceUnavailable(finding))
      .length,
    pricesUnavailable: findings.filter(priceUnavailable).length,
    incomplete: runs.filter(({ outcome }) => isIncomplete(outcome)).length,
  };
}

/** A price outage must never read as a zero-dollar scan, including in each wallet's totals. */
export function reportValue(runs: readonly CheckRun[]): string {
  const total = totals(runs);
  if (!total.pricesUnavailable) return usd(total.knownUsd);
  const known = total.count > total.unpriced + total.pricesUnavailable;
  const value = known ? `${usd(total.knownUsd)} known` : tokenHeadline(findingsIn(runs));
  return `${value}${known ? ',' : ' ·'} prices unavailable for ${total.pricesUnavailable}`;
}
