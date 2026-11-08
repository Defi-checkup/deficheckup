// Verified 2026-11-01 against solana-program/stake at
// 511afd3a7794f543be3028b333df0353ed113c64, interface/src/state.rs and
// warmup_cooldown_allowance.rs. The program uses the 9% rate at all retained epochs.
// Integer allowance arithmetic saturates at u128::MAX, matching the official implementation.
export const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = (1n << 128n) - 1n;
const min = (a: bigint, b: bigint) => (a < b ? a : b);
const max = (a: bigint, b: bigint) => (a > b ? a : b);

export interface HistoryEntry {
  effective: bigint;
  activating: bigint;
  deactivating: bigint;
}
export interface Delegation {
  stake: bigint;
  activation: bigint;
  deactivation: bigint;
}

export function stakeHistory(view: DataView, epoch: bigint): Map<bigint, HistoryEntry> {
  if (view.byteLength !== 16_392) throw new Error('Unexpected stake history length.');
  const count = view.getBigUint64(0, true);
  if (count !== min(epoch, 512n)) throw new Error('Incomplete stake history.');
  const history = new Map<bigint, HistoryEntry>();
  for (let i = 0; i < Number(count); i++) {
    const offset = 8 + i * 32;
    const e = view.getBigUint64(offset, true);
    if (e !== epoch - 1n - BigInt(i)) throw new Error('Stake history and clock disagree.');
    history.set(e, {
      effective: view.getBigUint64(offset + 8, true),
      activating: view.getBigUint64(offset + 16, true),
      deactivating: view.getBigUint64(offset + 24, true),
    });
  }
  return history;
}

function allowance(portion: bigint, clusterPortion: bigint, effective: bigint): bigint {
  if (portion === 0n || clusterPortion === 0n || effective === 0n) return 0n;
  return min(portion, min(U128_MAX, portion * effective * 900n) / (clusterPortion * 10_000n));
}

/** Effective stake, including cooldown. Never infer completion from an epoch comparison alone. */
export function effectiveStake(
  d: Delegation,
  epoch: bigint,
  history: ReadonlyMap<bigint, HistoryEntry>,
): bigint {
  let effective: bigint;
  if (d.activation === U64_MAX)
    effective = d.stake; // bootstrap
  else if (d.activation === d.deactivation || epoch <= d.activation) effective = 0n;
  else {
    const entry = history.get(d.activation);
    if (!entry)
      effective = d.stake; // activation aged out of the verified history
    else {
      effective = 0n;
      for (let prev = d.activation; prev < epoch && prev < d.deactivation; prev++) {
        const h = history.get(prev);
        if (!h) throw new Error('Missing activation history.');
        if (h.activating === 0n) break;
        effective = min(
          d.stake,
          effective + max(1n, allowance(d.stake - effective, h.activating, h.effective)),
        );
        if (effective === d.stake) break;
      }
    }
  }
  if (epoch <= d.deactivation) return effective;
  if (!history.has(d.deactivation)) return 0n; // fully cooled down once out of retained history
  for (let prev = d.deactivation; prev < epoch && effective > 0n; prev++) {
    const h = history.get(prev);
    if (!h) throw new Error('Missing cooldown history.');
    if (h.deactivating === 0n) break;
    effective = max(0n, effective - max(1n, allowance(effective, h.deactivating, h.effective)));
  }
  return effective;
}
