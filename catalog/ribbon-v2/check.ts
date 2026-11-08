import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type CheckContext,
  type CheckFinding,
  type EvmAddress,
} from '@deficheckup/engine';
import { evmContracts } from '../shared/contracts';
import { abi } from './abi';

// Two Ethereum Theta V2 vaults from the official deployed-contract list. Sourcify proxy,
// implementation, pauser and token sources verified on 2026-11-02. vaultParams(), vaultPauser(),
// vaultState(), receipts, shareBalances() and withdrawals() read at the blocks in recorded.json.
export const VAULTS = [
  {
    address: '0x25751853Eab4D0eB3652B5eB6ecB102A2789644B',
    name: 'ETH Call',
    asset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    symbol: 'ETH',
    shares: 'rETH-THETA',
  },
  {
    address: '0x65a833afDc250D9d38f8CD9bC2B1E3132dB13B2F',
    name: 'WBTC Call',
    asset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    symbol: 'WBTC',
    shares: 'rBTC-THETA',
  },
] as const;
const IMPLEMENTATION = '0xEaf743E9FE7449Ae3Ce02Bc01712666530D2666e';
// Each vault's vaultPauser() points here; pausedPositions(vault, owner) is a separate receipt.
export const VAULT_PAUSER = '0xE04e8Ae290965AD4F7E40c68041c493d2e89cDC3';
// Estimates, not measured. maxRedeem only retrieves shares; it does not pay the underlying.
const COMPLETE_GAS = 150_000n;
const REDEEM_GAS = 100_000n;
const READ_BUDGET_MS = 6_000;
const uint = (v: unknown): v is bigint => typeof v === 'bigint' && v >= 0n;
const round = (v: unknown): v is number =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 65535;
function receipt(v: unknown): v is [number, bigint] {
  return Array.isArray(v) && v.length === 2 && round(v[0]) && uint(v[1]);
}
function sharePair(v: unknown): v is [bigint, bigint] {
  return Array.isArray(v) && v.length === 2 && v.every(uint);
}
function deposit(v: unknown): v is [number, bigint, bigint] {
  return Array.isArray(v) && v.length === 3 && round(v[0]) && uint(v[1]) && uint(v[2]);
}
function state(v: unknown): v is [number, bigint, bigint, bigint, bigint] {
  return Array.isArray(v) && v.length === 5 && round(v[0]) && v[0] > 0 && v.slice(1).every(uint);
}
interface VaultResult {
  findings: CheckFinding[];
  notices: string[];
  failed: boolean;
}
async function scanVault(
  ctx: CheckContext,
  address: string,
  vault: (typeof VAULTS)[number],
  started: number,
): Promise<VaultResult> {
  const result: VaultResult = { findings: [], notices: [], failed: false };
  const read = (to: EvmAddress, functionName: string, args: unknown[] = []) =>
    ctx.readContract({ network: 'ethereum', to, abi, functionName, args });
  try {
    const [withdrawal, pending, shares, current, params, pauser, paused] = await Promise.all([
      read(vault.address, 'withdrawals', [address]),
      read(vault.address, 'depositReceipts', [address]),
      read(vault.address, 'shareBalances', [address]),
      read(vault.address, 'vaultState'),
      read(vault.address, 'vaultParams'),
      read(vault.address, 'vaultPauser'),
      read(VAULT_PAUSER, 'pausedPositions', [vault.address, address]),
    ]);
    if (
      !receipt(withdrawal) ||
      !deposit(pending) ||
      !receipt(paused) ||
      !state(current) ||
      !sharePair(shares) ||
      !Array.isArray(params) ||
      params.length !== 6 ||
      params[0] !== false ||
      params[1] !== vault.decimals ||
      typeof params[2] !== 'string' ||
      params[2].toLowerCase() !== vault.asset.toLowerCase() ||
      typeof pauser !== 'string' ||
      pauser.toLowerCase() !== VAULT_PAUSER.toLowerCase() ||
      withdrawal[0] > current[0] ||
      pending[0] > current[0] ||
      paused[0] > current[0]
    ) {
      throw Error('Unexpected vault state');
    }
    if (paused[1] > 0n) {
      result.findings.push({
        title: `Paused Ribbon ${vault.name} position`,
        network: 'ethereum',
        amount: { raw: paused[1], decimals: vault.decimals, symbol: vault.shares },
        valueUsd: null,
        claimCostUsd: null,
        deadline: null,
        heldBy: VAULT_PAUSER,
        note: `Pause receipt from round ${paused[0]}. These are shares, not claimable ${vault.symbol}. Resuming depends on rollover, pauser funding and possibly team action before a separate withdrawal.`,
      });
    }
    if (shares[1] > 0n) {
      const claimCostUsd = await ctx.gasCostUsd('ethereum', REDEEM_GAS).catch(() => null);
      result.findings.push({
        title: `Unredeemed Ribbon ${vault.name} shares`,
        network: 'ethereum',
        amount: { raw: shares[1], decimals: vault.decimals, symbol: vault.shares },
        valueUsd: null,
        claimCostUsd,
        deadline: null,
        heldBy: vault.address,
        note: 'maxRedeem retrieves vault shares only. Withdrawing the underlying requires initiating and completing a separate withdrawal after rollover. The fee estimate covers share redemption only.',
      });
    }
    if (pending[0] === current[0] && pending[1] > 0n) {
      result.notices.push(
        `Ribbon ${vault.name} has a pending deposit in round ${pending[0]}. It is not included as a matured withdrawal or unredeemed shares.`,
      );
    }
    if (withdrawal[1] === 0n) return result;
    if (withdrawal[0] === current[0]) {
      result.notices.push(
        `Ribbon ${vault.name} withdrawal round ${withdrawal[0]} is not closed. Its queued shares are not claimable yet; a stopped vault may need team action.`,
      );
      return result;
    }
    if (withdrawal[0] === 0 || Date.now() - started >= READ_BUDGET_MS)
      throw Error('Incomplete withdrawal');
    const [pps, backing] = await Promise.all([
      read(vault.address, 'roundPricePerShare', [BigInt(withdrawal[0])]),
      read(vault.asset, 'balanceOf', [vault.address]),
    ]);
    if (!uint(pps) || pps <= 1n || !uint(backing)) throw Error('Invalid withdrawal valuation');
    const raw = (withdrawal[1] * pps) / 10n ** BigInt(vault.decimals);
    if (raw === 0n || raw > backing) {
      result.findings.push({
        title: `Ribbon ${vault.name} matured withdrawal needs review`,
        network: 'ethereum',
        amount: null,
        valueUsd: null,
        claimCostUsd: null,
        deadline: null,
        heldBy: vault.address,
        note: 'The withdrawal round is closed, but a positive payout with sufficient token backing could not be confirmed. Do not assume the queued shares can be paid in full.',
      });
      return result;
    }
    const amount = { raw, decimals: vault.decimals, symbol: vault.symbol };
    const [price, claimCostUsd] = await Promise.all([
      lookupPrice(ctx, 'ethereum', vault.symbol === 'ETH' ? 'native' : vault.asset),
      ctx.gasCostUsd('ethereum', COMPLETE_GAS).catch(() => null),
    ]);
    result.findings.push({
      title: `Matured Ribbon ${vault.name} withdrawal (round ${withdrawal[0]})`,
      network: 'ethereum',
      amount,
      ...valueAtPrice(amount, price),
      claimCostUsd,
      deadline: null,
      heldBy: vault.address,
      note: 'The round is closed. completeWithdraw pays the finalized round amount; it does not redeem other shares or resume paused positions.',
    });
  } catch {
    result.failed = true;
  }
  return result;
}

export const ribbonV2Check: Check = {
  id: 'ribbon-v2',
  name: 'Ribbon Theta V2 withdrawals and shares',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  deadline: null,
  verifiedOn: '2026-11-02',
  officialLink: 'https://docs.ribbon.finance/theta-vault/user-guides/how-to-withdraw',
  contracts: evmContracts(
    'ethereum',
    IMPLEMENTATION,
    VAULT_PAUSER,
    ...VAULTS.flatMap((v) => [v.address, v.asset]),
  ),
  async check(address, ctx) {
    if (!isEvmAddress(address)) return { kind: 'error', reason: 'Not a valid EVM address.' };
    const started = Date.now();
    const results = await Promise.all(VAULTS.map((v) => scanVault(ctx, address, v, started)));
    const findings = results.flatMap((r) => r.findings);
    const notices = results.flatMap((r) => r.notices);
    const failed = results.some((r) => r.failed);
    const reason = 'Some Ribbon vault positions could not be checked completely.';
    if (findings.length)
      return {
        kind: 'found',
        findings: [findings[0]!, ...findings.slice(1)],
        ...(failed ? { partial: reason } : {}),
        ...(notices.length ? { notices } : {}),
      };
    if (failed) return { kind: 'error', reason };
    return { kind: 'nothing', ...(notices.length ? { note: notices.join(' ') } : {}) };
  },
};
