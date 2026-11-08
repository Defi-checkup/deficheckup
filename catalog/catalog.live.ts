// Runs the real checks against real RPCs. Never runs in CI: run it by hand with `pnpm test:live`.
// Every address here is public on-chain data, never the maintainer's wallets.
import { createCheckContext, type Check } from '@deficheckup/engine';
import { liquitySurplusCheck } from './liquity-surplus/check';
import liquityRecorded from './liquity-surplus/recorded.json';
import { lidoWithdrawalsCheck } from './lido-withdrawals/check';
import lidoRecorded from './lido-withdrawals/recorded.json';
import { ribbonV2Check } from './ribbon-v2/check';
import ribbonRecorded from './ribbon-v2/recorded.json';
import ribbonExtra from './ribbon-v2/extra-recorded.json';
import { immutableWithdrawalsCheck } from './immutable-withdrawals/check';
import immutableRecorded from './immutable-withdrawals/recorded.json';
import { describe, expect, it } from 'vitest';
import { aaveV2RewardsCheck } from './aave-v2-rewards/check';
import { compoundV2Check } from './compound-v2/check';
import { creamCheck } from './cream/check';
import { dsproxyCheck } from './dsproxy/check';
import { givTokenDistroCheck } from './giv-tokendistro/check';
import { hyperliquidCheck } from './hyperliquid/check';
import { checks } from './index';
import { instadappDsaCheck } from './instadapp-dsa/check';
import { koiAmplifierCheck } from './koi-amplifier/check';
import { koiFarmCheck } from './koi-farm/check';
import { koiFeesCheck } from './koi-fees/check';
import { koiLpCheck } from './koi-lp/check';
import { kittyLootFarmCheck } from './kitty-loot-farm/check';
import { solanaStakeCheck } from './solana-stake/check';
import { solanaRentCheck } from './solana-rent/check';
import { meteoraDlmmCheck } from './meteora-dlmm/check';
import dlmmRecorded from './meteora-dlmm/recorded.json';
import { kaminoLiquidityCheck } from './kamino-liquidity/check';
import { marginfiCheck } from './marginfi/check';
import { jupiterLockCheck } from './jupiter-lock/check';
import jupiterLock from './jupiter-lock/recorded.json';
import { merklCheck } from './merkl/check';
import { safeLockingCheck } from './safe-locking/check';
import { safeOwnerCheck } from './safe-owner/check';
import { uni2020Check } from './uni-2020/check';
import { zksyncLiteCheck } from './zksync-lite/check';

// InstaList accountLink(1) on 2026-11-01: an owner of DSA #1, with 9 DSAs in total.
const DSA_OWNER = '0xe866ecE4bbD0Ac75577225Ee2C464ef16DC8b1F3';
// DSProxyFactory Created event at block 11999974: owner and proxy, confirmed by ProxyRegistry.
const PROXY_OWNER = '0xFFFFF6E70842330948Ca47254F2bE673B1cb0dB7';
const PROXY = '0xd8317430fB69888B5b6a5337b61757aEc813e8DE';
// TokenDistro Allocate event at Gnosis block 49046951: a recipient with GIV claimable.
const GIV_RECIPIENT = '0xdF77A8D2Bf87c817F61d1786497B6446cde4c563';
// RewardsAccrued event near Ethereum block 16,000,000: a user with Aave V2 rewards never claimed.
const AAVE_V2_USER = '0x5DE65388270d7F121CEB0F2b505435E01705BaaF';
// UNI Transfer from the MerkleDistributor in 0x491566e6d500a66b94c4ba4cea99d8ede9c54af486bebca3e0b53ee9964d304a
// (2026-11-01): an eligible address whose share was claimed on its behalf.
const UNI_CLAIMED = '0xb65f77df78a0fcad61899bdafac01caba9b930ca';

// 20 random bytes generated on 2026-11-01: an address nobody has used. (0x...dEaD is not empty: it
// has Aave V2 rewards from aTokens people burned there.)
const FRESH = '0xf4d3591fe22333aecddd1be328a892904ee72593';
// Random 32-byte public key generated for these tests on 2026-11-01, never used on-chain.
const FRESH_SOLANA = '4VpicFPKd3vedBRF4Nh8dTiGGjisjvnibqgGb5RDmXW5';

// Checks that need our proxy run only when one is up, e.g. `pnpm --filter @deficheckup/proxy dev`
// and DEFICHECKUP_PROXY_URL=http://localhost:8787. The origin must be in its ALLOWED_ORIGINS.
const PROXY_URL = process.env.DEFICHECKUP_PROXY_URL;
const PROXY_ORIGIN = process.env.DEFICHECKUP_PROXY_ORIGIN ?? 'http://localhost:4321';

function liveContext() {
  return createCheckContext({
    ...(PROXY_URL ? { proxyUrl: PROXY_URL } : {}),
    // Node sends no Origin header on its own; a browser on our site would.
    fetchFn: (input, init) =>
      fetch(input, { ...init, headers: { ...init?.headers, origin: PROXY_ORIGIN } }),
  });
}

async function timed(check: Check, address: string) {
  const started = performance.now();
  const outcome = await check.check(address, liveContext());
  return { outcome, ms: performance.now() - started };
}

describe('live catalog', () => {
  it.skipIf(!PROXY_URL)(
    'reads a public funded Jupiter Lock recipient through the proxy',
    async () => {
      const { outcome, ms } = await timed(jupiterLockCheck, jupiterLock.address);
      expect(outcome).toMatchObject({ kind: 'found', findings: [{ amount: null }] });
      if (outcome.kind === 'found') expect(outcome.partial).toBeUndefined();
      expect(ms).toBeLessThan(10_000);
    },
  );
  it.skipIf(!PROXY_URL)(
    'reads marginfi accounts through the proxy for a public authority',
    async () => {
      const { outcome, ms } = await timed(
        marginfiCheck,
        '13iybKSZYfQh49XntMZ2StCUDSmGzHeMwpSgmPcv15X',
      );
      expect(outcome).toMatchObject({ kind: 'found' });
      expect(ms).toBeLessThan(10_000);
    },
  );
  it.skipIf(!PROXY_URL)(
    'reads Kamino liquidity shares through the proxy for the SDK public example',
    async () => {
      const { outcome, ms } = await timed(
        kaminoLiquidityCheck,
        'HrwbdQYwSnAyVpVHuGQ661HiNbWmGjDp5DdDR9YMw7Bu',
      );
      expect(outcome).toMatchObject({ kind: 'found' });
      expect(ms).toBeLessThan(10_000);
    },
  );
  it.skipIf(!PROXY_URL)(
    'reads Meteora DLMM rent through the proxy for a public owner',
    async () => {
      const { outcome, ms } = await timed(meteoraDlmmCheck, dlmmRecorded.empty.address);
      expect(outcome).toMatchObject({
        kind: 'found',
        findings: expect.arrayContaining([
          expect.objectContaining({ title: 'SOL rent in an empty Meteora DLMM position' }),
        ]),
      });
      expect(ms).toBeLessThan(10_000);
    },
  );
  it.skipIf(!PROXY_URL)('reads Solana rent in both token programs for a public owner', async () => {
    // Token approve instruction in 53xpKVXoqaTyqYxupPm1mbJmVshNJjPvAN31VGAiqDgHXso6jLsKwyo3hh359JT1xDLPBXc9RGdHGd8N1LXiv7NN.
    const { outcome, ms } = await timed(
      solanaRentCheck,
      'BZ2Xivthz6aPSrZKSvuwNstwMqsuZKRaFxYBXw3epmSJ',
    );
    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [{ network: 'solana', amount: { symbol: 'SOL' } }],
    });
    if (outcome.kind === 'found') expect(outcome.partial).toBeUndefined();
    expect(ms).toBeLessThan(10_000);
  });
  it.skipIf(!PROXY_URL)('reads Solana native stake for a public mainnet withdrawer', async () => {
    // Public initialize instruction in 3D75z57xmuvmvkr6uySNkoHuN2zqivjL6mQavb41jLsKsHW8mUXH8pe3qVV697EsseajuuSFkZFwcUGzYxQkStp4.
    const { outcome, ms } = await timed(
      solanaStakeCheck,
      'VTR3xEg5wYw6GupqzHDh2hYc3nh7jUoooptzLQn3t3d',
    );
    expect(outcome.kind).not.toBe('error');
    if (outcome.kind === 'nothing') expect(outcome.note).toContain('stake');
    expect(ms).toBeLessThan(10_000);
  });
  it('reads KittyLootFarm for a public staker found in its Unstake event at block 80438533', async () => {
    const { outcome, ms } = await timed(
      kittyLootFarmCheck,
      '0x0000000000000000000000025102e3E348871DFB',
    );
    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [{ network: 'flow-evm', heldBy: '0x653659DC5177720fCd92248559C5763Ac2fBFa9E' }],
    });
    expect(ms).toBeLessThan(10_000);
  });
  it('walks all 9 DSAs of a real owner in under 10 seconds', async () => {
    const { outcome, ms } = await timed(instadappDsaCheck, DSA_OWNER);

    // On 2026-11-01 three of those DSAs held COMP or DAI: findings from several DSAs prove the walk.
    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(new Set(outcome.findings.map((f) => f.heldBy)).size).toBeGreaterThan(1);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('reads a real DSProxy in under 10 seconds', async () => {
    const { outcome, ms } = await timed(dsproxyCheck, PROXY_OWNER);

    expect(['found', 'nothing']).toContain(outcome.kind);
    if (outcome.kind === 'found') {
      expect(outcome.findings.every((f) => f.heldBy === PROXY)).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('finds claimable GIV for a real GIVstream recipient', async () => {
    const { outcome, ms } = await timed(givTokenDistroCheck, GIV_RECIPIENT);

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ network: 'gnosis' }] });
    expect(ms).toBeLessThan(10_000);
  });

  it('finds unclaimed Aave V2 rewards for a real user, with a price', async () => {
    const { outcome, ms } = await timed(aaveV2RewardsCheck, AAVE_V2_USER);

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') expect(outcome.findings[0].valueUsd).toBeGreaterThan(0);
    expect(ms).toBeLessThan(10_000);
  });

  it('finds a real UNI 2020 entry already claimed, through the published list', async () => {
    const { outcome, ms } = await timed(uni2020Check, UNI_CLAIMED);

    expect(outcome).toEqual({ kind: 'nothing', alreadyClaimed: true });
    expect(ms).toBeLessThan(10_000);
  });

  it('finds no UNI 2020 entry for a fresh address', async () => {
    expect((await timed(uni2020Check, FRESH)).outcome).toEqual({ kind: 'nothing' });
  });

  it('reads all four Hyperliquid balances of a real address', async () => {
    // On 2026-11-01 the zero address held USDC and other tokens in Hyperliquid spot, sent by mistake.
    const { outcome, ms } = await timed(
      hyperliquidCheck,
      '0x0000000000000000000000000000000000000000',
    );

    expect(outcome).toMatchObject({ kind: 'found' });
    if (outcome.kind === 'found') expect(outcome.partial).toBeUndefined();
    expect(ms).toBeLessThan(10_000);
  });

  it('finds unclaimed Merkl rewards for a real address, across networks', async () => {
    // On 2026-11-01 the zero address had unclaimed ANGLE on Ethereum (and the API root matched
    // the Distributor's tree() on-chain).
    const { outcome, ms } = await timed(merklCheck, '0x0000000000000000000000000000000000000000');

    expect(outcome).toMatchObject({ kind: 'found' });
    expect(ms).toBeLessThan(10_000);
  });

  it.skipIf(!PROXY_URL)('finds what a real Safe holds for one of its owners', async () => {
    // On 2026-11-01 this was an owner of the Safe that owns the SAFE locking contract
    // (0x8CF60B289f8d31F737049B590b5E4285Ff0Bd1D1, 3 signatures), which held ETH and SAFE.
    const { outcome, ms } = await timed(
      safeOwnerCheck,
      '0xee375Eb11b4Ca34407a49eD9E9D9bD246f9bf9d5',
    );

    expect(outcome).toMatchObject({ kind: 'found' });
    if (outcome.kind === 'found') {
      expect(
        outcome.findings.some((f) => f.heldBy === '0x8CF60B289f8d31F737049B590b5E4285Ff0Bd1D1'),
      ).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('finds a real Compound V2 supply, with the market in full', async () => {
    // Top cUSDC holder in Blockscout on 2026-11-01, confirmed with getAccountSnapshot: a supply of
    // about 0.18 USDC, and a simulated redeem of part of it passed.
    const { outcome, ms } = await timed(
      compoundV2Check,
      '0x3BA7984a49863dABd8282d08D6ec9496725Ed7B8',
    );

    expect(outcome).toMatchObject({ kind: 'found' });
    if (outcome.kind === 'found') {
      expect(
        outcome.findings.some((f) => f.heldBy === '0x39AA39c021dfbaE8faC545936693aC917d5E7563'),
      ).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('says real COMP rewards are lost, counting the ones not booked yet', async () => {
    // A cETH holder on 2026-11-01: 16.26 COMP accrued that the Comptroller cannot pay. The amount
    // matched CompoundLens getCompBalanceMetadataExt.
    const { outcome, ms } = await timed(
      compoundV2Check,
      '0xC4026A7C78AF8D50015A2BCb260dFf9078bc3D3e',
    );

    const text =
      outcome.kind === 'found'
        ? outcome.notices?.join(' ')
        : 'reason' in outcome
          ? outcome.reason
          : '';
    expect(text).toContain('16.2594 COMP of Compound V2 rewards cannot be claimed');
    expect(ms).toBeLessThan(10_000);
  });

  it('says a real Cream supply is lost', async () => {
    // A crAAVE holder on 2026-11-01: 997,064,981,235 crAAVE, about 208.37 AAVE. A simulated
    // redeem returned error 14 (not enough cash) and the Comptroller rejects all redeems anyway.
    const { outcome, ms } = await timed(creamCheck, '0x6Fb34dC6feBaDd5cFCEc48AfdFDC44449deBec48');

    expect(outcome.kind).toBe('lost');
    if (outcome.kind === 'lost') expect(outcome.reason).toContain('AAVE');
    expect(ms).toBeLessThan(10_000);
  });

  it('finds unclaimed Koi fees for a real former liquidity provider', async () => {
    // An LP Transfer in the USDC.e/WETH pool on 2026-11-01: no LP left, but 4.65 USDC.e and
    // 0.00206 WETH still credited in claimable0 and claimable1.
    const { outcome, ms } = await timed(koiFeesCheck, '0xD2F479A79A85adE26Ba9d034a2d651D0FD4FF8aB');

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(
        outcome.findings.some((f) => f.heldBy === '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4'),
      ).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('finds Koi liquidity still held in a wallet', async () => {
    // A public holder of the USDC.e/WETH LP on 2026-11-01 (Blockscout holder list): about
    // 2,042 USDC.e and 0.90 WETH.
    const { outcome, ms } = await timed(koiLpCheck, '0x462B90d8Ee1DE0Dfa4F4FB867238555ED727B724');

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(
        outcome.findings.some((f) => f.heldBy === '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4'),
      ).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('finds LP still staked in a Mute Amplifier', async () => {
    // A staker of 2023 (first LP transfers into the Amplifier) whose stake was still there on
    // 2026-11-01: about 19.9 USDC.e and 0.0088 WETH. withdraw() simulated with success.
    const { outcome, ms } = await timed(
      koiAmplifierCheck,
      '0xbBe255A9244b45f08CEe5C78BBB4E0b980e227B2',
    );

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(
        outcome.findings.some((f) => f.heldBy === '0x06e8D81f824F8b8758A75Fe9616Dd154400Cb7a4'),
      ).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('finds LP and a reward still staked in a Koi farm', async () => {
    // A staker of December 2024 (LP transfers into the farm) whose stake was still there on
    // 2026-11-01: a small share of the USDC.e/WETH pool and about 2.1 KOI not paid.
    const { outcome, ms } = await timed(koiFarmCheck, '0x5A9b86708B7aA08e4a73f792F156D8A96e163136');

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(outcome.findings.some((f) => f.amount?.symbol === 'KOI')).toBe(true);
      expect(
        outcome.findings.some((f) => f.heldBy === '0xe5095A9d6fe9573722706062EAafaE422134cd33'),
      ).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it.skipIf(!PROXY_URL)('finds zkSync Lite balances through the proxy', async () => {
    // 0x...dEaD held ETH and tokens on zkSync Lite at the shutdown (people sent them there); on
    // 2026-11-01 its ETH (claim 139) was not claimed.
    const { outcome, ms } = await timed(
      zksyncLiteCheck,
      '0x000000000000000000000000000000000000dEaD',
    );

    expect(outcome.kind).toBe('found');
    if (outcome.kind === 'found') {
      expect(outcome.findings.some((f) => f.amount?.symbol === 'ETH')).toBe(true);
    }
    expect(ms).toBeLessThan(10_000);
  });

  it('finds SAFE unlocked and never withdrawn by a real holder', async () => {
    // Unlocked event at block 26,166,338: 2,609.32 SAFE unlocked, matured on 2026-10-12 and still
    // not withdrawn on 2026-11-01.
    const { outcome, ms } = await timed(
      safeLockingCheck,
      '0x2CB22c72c51801e6BC4C7808bDC81715Ac481011',
    );

    expect(outcome).toMatchObject({
      kind: 'found',
      findings: [{ title: 'SAFE unlocked but never withdrawn' }],
    });
    expect(ms).toBeLessThan(10_000);
  });

  // Checks that ask our proxy need one running (see PROXY_URL above).
  const needsProxy = new Set([
    'safe-owner',
    'zksync-lite',
    'solana-stake',
    'solana-rent',
    'meteora-dlmm',
    'kamino-liquidity',
    'marginfi',
    'jupiter-lock',
  ]);
  it.each(checks.filter((c) => PROXY_URL || !needsProxy.has(c.id)).map((c) => [c.id, c] as const))(
    '%s reports nothing for an unused address',
    async (_id, check) => {
      const { outcome } = await timed(
        check,
        check.networks.includes('solana') ? FRESH_SOLANA : FRESH,
      );
      expect(outcome.kind).toBe('nothing');
    },
  );
});

// M10 uses only the authorized eth_call RPC path, including Multicall3. Price and gas helpers
// are disabled here because their provider methods are outside this session's network scope.
// Each owner below has public event or request provenance in the corresponding recorded.json.
describe('M10 live public catalog reads (RPC only)', () => {
  async function rpcOnly(check: Check, address: string) {
    const ctx = createCheckContext();
    const started = performance.now();
    const outcome = await check.check(address, {
      ...ctx,
      priceUsd: async () => null,
      gasCostUsd: async () => null,
    });
    expect(performance.now() - started).toBeLessThan(10_000);
    return outcome;
  }
  it('finds Liquity surplus for a public CollBalanceUpdated recipient', async () => {
    expect(await rpcOnly(liquitySurplusCheck, liquityRecorded.owner)).toMatchObject({
      kind: 'found',
    });
  });
  it('finds Lido finalized claimable ETH for a public request owner', async () => {
    expect(await rpcOnly(lidoWithdrawalsCheck, lidoRecorded.owner)).toMatchObject({
      kind: 'found',
      findings: [{ amount: { symbol: 'ETH' } }],
    });
  });
  it('finds a public matured Ribbon withdrawal', async () => {
    expect(await rpcOnly(ribbonV2Check, ribbonRecorded.owners[0]!)).toMatchObject({
      kind: 'found',
      findings: [{ title: expect.stringContaining('Matured Ribbon') }],
    });
  });
  it('keeps a public Ribbon round that is not closed separate', async () => {
    expect(await rpcOnly(ribbonV2Check, ribbonRecorded.owners[1]!)).toMatchObject({
      kind: 'nothing',
      note: expect.stringContaining('not closed'),
    });
  });
  it('finds a public paused Ribbon receipt', async () => {
    const owner = ribbonExtra.selected.find((r) => r.kind === 'paused')!.owner;
    expect(await rpcOnly(ribbonV2Check, owner)).toMatchObject({
      kind: 'found',
      findings: expect.arrayContaining([
        expect.objectContaining({ title: 'Paused Ribbon ETH Call position' }),
      ]),
    });
  });
  it('finds public unredeemed Ribbon shares', async () => {
    const owner = ribbonExtra.selected.find((r) => r.kind === 'unredeemed')!.owner;
    expect(await rpcOnly(ribbonV2Check, owner)).toMatchObject({
      kind: 'found',
      findings: expect.arrayContaining([
        expect.objectContaining({ title: 'Unredeemed Ribbon ETH Call shares' }),
      ]),
    });
  });
  it('finds a public Immutable pending ETH withdrawal with explicit limited coverage', async () => {
    expect(await rpcOnly(immutableWithdrawalsCheck, immutableRecorded.owner)).toMatchObject({
      kind: 'found',
      partial: expect.stringContaining('Legacy keys'),
      findings: [{ amount: { symbol: 'ETH' } }],
    });
  });
});
