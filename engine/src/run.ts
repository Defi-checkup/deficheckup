import { addressKind } from './address';
import type { Check, CheckContext, CheckOutcome } from './types';

export interface CheckRun {
  checkId: string;
  address: string;
  outcome: CheckOutcome;
  durationMs: number;
}

export type Progress =
  | { state: 'started'; checkId: string; address: string }
  | { state: 'finished'; checkId: string; address: string; outcome: CheckOutcome };

export interface RunOptions {
  /** Longest a single check may take before it is reported as an error. */
  timeoutMs?: number;
  /** Called as each check starts and finishes, to show live progress. */
  onProgress?: (progress: Progress) => void;
}

export interface RunResult {
  runs: CheckRun[];
  /** Inputs that are neither an EVM nor a Solana address. No check ran for them. */
  invalidAddresses: string[];
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** A check runs for an address when it covers that kind of network. */
function covers(check: Check, kind: 'evm' | 'solana'): boolean {
  return check.networks.some((network) => (network === 'solana') === (kind === 'solana'));
}

/**
 * Runs every check against every address it applies to, all at once.
 * One slow or broken check never stops the others: it comes back as an error outcome.
 */
export async function runChecks(
  checks: readonly Check[],
  addresses: readonly string[],
  ctx: CheckContext,
  { timeoutMs = DEFAULT_TIMEOUT_MS, onProgress }: RunOptions = {},
): Promise<RunResult> {
  const invalidAddresses: string[] = [];
  const jobs: Promise<CheckRun>[] = [];

  for (const address of addresses) {
    const kind = addressKind(address);
    if (kind === null) {
      invalidAddresses.push(address);
      continue;
    }
    for (const check of checks) {
      if (covers(check, kind)) jobs.push(runOne(check, address, ctx, timeoutMs, onProgress));
    }
  }

  return { runs: await Promise.all(jobs), invalidAddresses };
}

/** A broken progress listener must never cost the user the scan results. */
function notify(onProgress: RunOptions['onProgress'], progress: Progress) {
  try {
    onProgress?.(progress);
  } catch {
    // ignored on purpose
  }
}

async function runOne(
  check: Check,
  address: string,
  ctx: CheckContext,
  timeoutMs: number,
  onProgress: RunOptions['onProgress'],
): Promise<CheckRun> {
  notify(onProgress, { state: 'started', checkId: check.id, address });
  const start = performance.now();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CheckOutcome>((resolve) => {
    timer = setTimeout(
      () => resolve({ kind: 'error', reason: `Timed out after ${timeoutMs / 1000} s.` }),
      timeoutMs,
    );
  });

  let outcome: CheckOutcome;
  try {
    outcome = await Promise.race([check.check(address, ctx), timeout]);
  } catch (error) {
    outcome = { kind: 'error', reason: error instanceof Error ? error.message : String(error) };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  notify(onProgress, { state: 'finished', checkId: check.id, address, outcome });
  return { checkId: check.id, address, outcome, durationMs: performance.now() - start };
}
