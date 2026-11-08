import {
  lookupPrice,
  valueAtPrice,
  isEvmAddress,
  type Check,
  type CheckFinding,
} from '@deficheckup/engine';
import { evmContracts } from '../shared/contracts';
import { abi } from './abi';

// Official finalise-pending-withdrawals manual, verified on 2026-11-02. Sourcify proxy and
// current implementation verified; implementation(), getEthKey(), getAssetInfo() and all
// listed getWithdrawalBalance() reads are pinned in recorded.json. ETH withdraw passed eth_call.
export const IMMUTABLE_BRIDGE = '0x5FDCCA53617f4d2b9134B29090C87D01058e27e9';
const IMPLEMENTATION = '0x273b65a7231321D4ee47a4c47408Ef43517455Ec';
// Sourcify resolves the USDC ZeppelinOS proxy to this verified FiatTokenV2_2 source.
const USDC_IMPLEMENTATION = '0x43506849D7C04F9138D1A2050bbF3A0c054402dd';
// A deliberately finite subset of the manual's mainnet fungible asset table. getAssetInfo
// confirmed the ETH/ERC20 selector and token, token decimals/symbol and sources were verified.
export const ASSETS = [
  {
    symbol: 'ETH',
    token: 'native',
    decimals: 18,
    id: 1103114524755001640548555873671808205895038091681120606634696969331999845790n,
  },
  {
    symbol: 'IMX',
    token: '0xf57e7e7c23978c3caec3c3548e3d615c346e79ff',
    decimals: 18,
    id: 88914301944088089141574999348394996493546404963067902156417732601144566237n,
  },
  {
    symbol: 'USDC',
    token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    id: 1147032829293317481173155891309375254605214077236177772270270553197624560221n,
  },
] as const;
// Estimate, not measured: one standard registered-key withdrawal. No key registration included.
const CLAIM_GAS = 150_000n;
const COVERAGE =
  'Only the standard address-derived Stark key and the listed ETH, IMX and USDC assets were checked. Legacy keys, other fungible assets and NFTs are unresolved.';

function matchesAsset(info: unknown, token: string): boolean {
  if (typeof info !== 'string') return false;
  // Verified AssetInfo format: ETH selector only, or ERC20 selector followed by ABI address.
  const expected =
    token === 'native'
      ? '0x8322fff2'
      : `0xf47261b0${'0'.repeat(24)}${token.slice(2).toLowerCase()}`;
  return info.toLowerCase() === expected;
}
export const immutableWithdrawalsCheck: Check = {
  id: 'immutable-withdrawals',
  name: 'Immutable X pending L1 withdrawals',
  networks: ['ethereum'],
  category: 'closed-network',
  status: { kind: 'open' },
  deadline: null,
  officialLink:
    'https://github.com/immutable/imx-migration-contracts/blob/main/docs/finalise-pending-withdrawals.md',
  verifiedOn: '2026-11-02',
  contracts: evmContracts(
    'ethereum',
    IMMUTABLE_BRIDGE,
    IMPLEMENTATION,
    USDC_IMPLEMENTATION,
    ...ASSETS.flatMap((a) => (a.token === 'native' ? [] : [a.token])),
  ),
  async check(address, ctx) {
    if (!isEvmAddress(address)) return { kind: 'error', reason: 'Not a valid EVM address.' };
    const key = BigInt(address);
    const read = (functionName: string, args: unknown[]) =>
      ctx.readContract({ network: 'ethereum', to: IMMUTABLE_BRIDGE, abi, functionName, args });
    try {
      const recipient = await read('getEthKey', [key]);
      // Most wallets never registered this key. Reporting that as a failure would put Immutable
      // under "Failed or partial" in almost every scan; the note keeps the limited scope visible.
      if (typeof recipient === 'string' && isEvmAddress(recipient) && BigInt(recipient) === 0n)
        return { kind: 'nothing', note: `No standard Stark key is registered. ${COVERAGE}` };
      if (
        typeof recipient !== 'string' ||
        !isEvmAddress(recipient) ||
        recipient.toLowerCase() !== address.toLowerCase() ||
        BigInt(recipient) === 0n
      ) {
        return {
          kind: 'error',
          reason: `The standard Stark key could not be resolved to this address. ${COVERAGE}`,
        };
      }
      const results = await Promise.all(
        ASSETS.map(async (asset) => {
          try {
            const [info, balance] = await Promise.all([
              read('getAssetInfo', [asset.id]),
              read('getWithdrawalBalance', [key, asset.id]),
            ]);
            if (!matchesAsset(info, asset.token) || typeof balance !== 'bigint' || balance < 0n)
              throw Error('Unresolved asset');
            if (balance === 0n) return { finding: null, failed: false };
            // The current implementation returns non-quantized token units. Do not apply quantum
            // again: doing so overstates ETH and IMX by 100,000,000.
            const amount = { raw: balance, decimals: asset.decimals, symbol: asset.symbol };
            const [price, claimCostUsd] = await Promise.all([
              lookupPrice(ctx, 'ethereum', asset.token),
              ctx.gasCostUsd('ethereum', CLAIM_GAS).catch(() => null),
            ]);
            const finding: CheckFinding = {
              title: `${asset.symbol} awaiting Immutable X L1 finalization`,
              network: 'ethereum',
              amount,
              ...valueAtPrice(amount, price),
              claimCostUsd,
              deadline: null,
              heldBy: IMMUTABLE_BRIDGE,
              note: `Standard Stark key ${key}; asset ID ${asset.id}. withdraw pays the address returned by getEthKey. This is a prepared L1 withdrawal, separate from the automated migration.`,
            };
            return { finding, failed: false };
          } catch {
            return { finding: null, failed: true };
          }
        }),
      );
      const findings = results.flatMap((r) => (r.finding ? [r.finding] : []));
      const partial = [
        COVERAGE,
        ...(results.some((r) => r.failed)
          ? ['Some listed assets could not be resolved or read.']
          : []),
      ].join(' ');
      // Standard keys cannot reveal whether a user also has a legacy Stark key, so a clean zero
      // is "nothing" only with the coverage note; a failed read stays an error.
      if (!findings.length)
        return results.some((r) => r.failed)
          ? {
              kind: 'error',
              reason: `No pending balance was confirmed within this limited check. ${partial}`,
            }
          : { kind: 'nothing', note: `No pending withdrawal for the listed assets. ${COVERAGE}` };
      return { kind: 'found', findings: [findings[0]!, ...findings.slice(1)], partial };
    } catch {
      return {
        kind: 'error',
        reason: `The Immutable X pending withdrawal could not be read. ${COVERAGE}`,
      };
    }
  },
};
