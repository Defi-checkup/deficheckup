import type { CheckContext } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { givTokenDistroCheck } from './check';

// Recorded shapes, placeholder address. Never a real user's wallet.
const WALLET = '0x000000000000000000000000000000000000dEaD';

function fakeContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    readContract: async () => 0n,
    nativeBalance: async () => 0n,
    solanaRpc: async () => {
      throw new Error('Unexpected Solana RPC');
    },
    proxy: async () => {
      throw new Error('unexpected proxy');
    },
    readSelector: async () => {
      throw new Error('unexpected readSelector');
    },
    priceUsd: async () => 0.005,
    gasCostUsd: async () => 0.001,
    fetchJson: async () => undefined,
    ...overrides,
  };
}

describe('giv-tokendistro check', () => {
  it('reads claimableNow on Gnosis with the full address', async () => {
    const readContract = vi.fn(async () => 0n);

    expect(await givTokenDistroCheck.check(WALLET, fakeContext({ readContract }))).toEqual({
      kind: 'nothing',
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        network: 'gnosis',
        to: '0xc0dbDcA66a0636236fAbe1B3C16B1bD4C84bB1E1',
        functionName: 'claimableNow',
        args: [WALLET],
      }),
    );
  });

  it('finds GIV ready to claim, priced on Gnosis, with the measured claim gas', async () => {
    const priceUsd = vi.fn(async () => 0.005);
    const gasCostUsd = vi.fn(async () => 0.001);
    const outcome = await givTokenDistroCheck.check(
      WALLET,
      fakeContext({
        readContract: async () => 9_656n * 10n ** 18n,
        priceUsd,
        gasCostUsd,
      }),
    );

    expect(outcome).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'GIV ready to claim from your GIVstream',
          network: 'gnosis',
          amount: { raw: 9_656n * 10n ** 18n, decimals: 18, symbol: 'GIV' },
          valueUsd: expect.closeTo(48.28, 6),
          claimCostUsd: 0.001,
          deadline: null,
          heldBy: '0xc0dbDcA66a0636236fAbe1B3C16B1bD4C84bB1E1',
        },
      ],
    });
    expect(priceUsd).toHaveBeenCalledWith('gnosis', '0x4f4F9b8D5B4d0Dc10506e5551B0513B61fD59e75');
    expect(gasCostUsd).toHaveBeenCalledWith('gnosis', 82_000n);
  });

  it('still reports the GIV when no price is known', async () => {
    const outcome = await givTokenDistroCheck.check(
      WALLET,
      fakeContext({ readContract: async () => 1n, priceUsd: async () => null }),
    );

    expect(outcome).toMatchObject({ kind: 'found', findings: [{ valueUsd: null }] });
  });

  it('reports an error for an unexpected response, not nothing', async () => {
    const outcome = await givTokenDistroCheck.check(
      WALLET,
      fakeContext({ readContract: async () => '0x' }),
    );

    expect(outcome).toMatchObject({ kind: 'error' });
  });

  it('reports an error for an invalid address, without reading the chain', async () => {
    const readContract = vi.fn(async () => 0n);

    expect(
      await givTokenDistroCheck.check('giveth.eth', fakeContext({ readContract })),
    ).toMatchObject({ kind: 'error' });
    expect(readContract).not.toHaveBeenCalled();
  });
});
