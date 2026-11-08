import type { CheckContext, ReadRequest } from '@deficheckup/engine';
import { describe, expect, it, vi } from 'vitest';
import { uni2020Check } from './check';

const DATA =
  'https://raw.githubusercontent.com/Uniswap/mrkl-drop-data-chunks/c215bf1e4360205acdc6c154389b10a2f287974d/chunks/';
const DISTRIBUTOR = '0x090D4613473dEE047c3f2706764f49E0821D256e';
const UNI = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

// Recorded from Uniswap's published chunk 0x0000...0000 (commit c215bf1e). The first two entries of
// the tree belong to the placeholder addresses 0x0 and 0x1, never a real user's wallet.
const ZERO = '0x0000000000000000000000000000000000000000';
const ONE = '0x0000000000000000000000000000000000000001';
const ENTRY_ZERO = {
  index: 0,
  amount: '0x15af1d78b58c400000',
  proof: [
    '0xb1bcfa5de1b8585bb7c22411cd0c7ee3ac895000053f72ed782d475d31b9c1ee',
    '0xe79bbbfb9c1e4a64fe29a3a0e1f457de1bfea98bcd79626f168d44f10976a96a',
    '0x0dcbac62f9582c69faf2c9ae1006247250c79d3f4751e6977dfca0449e3bd7be',
    '0x82c3119f1abaded54d1e5c2885114afe7e9027e73524d74ccc07a64187eff1ef',
    '0x166372f4d7a998c57022e9ff0b3991a836b65c9dc14f89b02d61c3fa3719f912',
    '0x3f989a38cb736649d32bbe3adb3b47890ffa2cd00d110679fe62b098631e544a',
    '0x684111c5a17e8fcf15309a665b94659797b98e8b00ea2a1382df42d9b2aef291',
    '0xd030429c1f0aebde9f653c2b64ba160999ce6ddebf364a6945c89960d6b2c1d0',
    '0x2c4b5dbbda9a15cf7332c738c8443c52d941028ae5a4830ae7ca78a3e42355ae',
    '0x78c0ffe4e41863b4abb2f76be94a908d6263eccf608ed569c87dc7243138ca53',
    '0x75fc639ce315996ae068c1ea0996d1246b8c6351c8caa4ab8bc53fd77c95ace6',
    '0x1bc1e685bd3df50227c5ab93475814bb11641b5a84bfd8a5d4eee02396dc5297',
    '0x627ddd1e7ef9c1e3a641d0226ecd7a298c6a2272181d3af505c156225846c283',
    '0x2f97c1284514856376fa0d4cc248da5fac156797e1a62ee4d4e5b79330cd18ce',
    '0x5665fc633c28726ccf726054971b13edd877c99c8d2a64fb0d74c92bb7d39e1d',
    '0x6d79bbfc56dbc08f3c0ab6a11753883b322781b949cd36778c2f313f13212977',
    '0x26ecbdae89fc55ef1d8ef396bfd7ed36d54fc821c8f283fdbb5dcebec5f739df',
    '0xdeab88d76ca5389f96456da4fb9f1b2d7a54cb9ed14aab85dadcd9ab1d8e9cba',
  ],
};
const ENTRY_ONE = {
  index: 1,
  amount: '0x0144a4e34076250ab000',
  proof: [
    '0xb40ca39f444f4b17c03e76c1a8c95adaa9de0fa51a4c74e4bac15de7b0a05911',
    '0xa78c360afaf227f5567717e4b663655b2713d222e7fd6c1133f44840943255c6',
    '0x4a4a79d12b3ca63aa4a66b1b4c32fb0839bc42e43a5477fa516addda285159bd',
    '0xaf47b6e0c0dcdb52d3fa0291886138c2f88514c1e0e43a0b3ac7bbd34bc9f701',
    '0x48a5b38119f6ca31f932afce155f5898cb2b43294c48d9f1ff4da38e0be9908b',
    '0x22e948f9c0d1c436550df3e2761ae0a81385b351c397f46799aa561195c581bb',
    '0xe1f7e2e57243bddfe6961fed5b5cd82b4557f3a78cefdb8471263eaf17b43140',
    '0x067139adf053ad7a29dd54f5733cc8dce9ed26066ddb2a0acd73bbd44c5f6420',
    '0x441f3c5f5fc0e49097b39a07b6e1133b23d272a3cc1b43ab5e658327c58546cd',
    '0x5eb54fec6b6144af3ba4ed089996cc3bfb64c08dc7bf126b654405baac9f3b4e',
    '0xf957e9764a1d6df20f33c787755d1b6cc94d315e951cda4efa40c378ced14fde',
    '0xf3bcfcf9ae1fdeb856b778f122afcac0627909ce85f289572de2fae795c9250e',
    '0xbc8137d1ab6b910dbaa9163c263cd68ec44c72cd3f928381ce96bc13a6a66ab1',
    '0x2f97c1284514856376fa0d4cc248da5fac156797e1a62ee4d4e5b79330cd18ce',
    '0x5665fc633c28726ccf726054971b13edd877c99c8d2a64fb0d74c92bb7d39e1d',
    '0x6d79bbfc56dbc08f3c0ab6a11753883b322781b949cd36778c2f313f13212977',
    '0x26ecbdae89fc55ef1d8ef396bfd7ed36d54fc821c8f283fdbb5dcebec5f739df',
    '0xdeab88d76ca5389f96456da4fb9f1b2d7a54cb9ed14aab85dadcd9ab1d8e9cba',
  ],
};
const ONE_AMOUNT = BigInt(ENTRY_ONE.amount);

const MAPPING = {
  '0x0000000000000000000000000000000000000000': '0x0003092ffbaaaa22d8d9c9715b357e01db1915b7',
  '0x0003189fa95767df7c2d95142775d9e32f81009d': '0x00158a74921620b39e5c3afe4dca79feb2c2c143',
};
const CHUNK = { [ZERO]: ENTRY_ZERO, [ONE]: ENTRY_ONE };

/** Answers like the distributor: isClaimed by index, and the UNI it still holds. */
function fakeContext(
  options: {
    claimed?: unknown;
    left?: unknown;
    files?: Record<string, unknown>;
  } = {},
  overrides: Partial<CheckContext> = {},
): CheckContext {
  const files: Record<string, unknown> = options.files ?? {
    [`${DATA}mapping.json`]: MAPPING,
    [`${DATA}${ZERO}.json`]: CHUNK,
  };
  return {
    readContract: async ({ functionName }: ReadRequest) =>
      functionName === 'isClaimed'
        ? (options.claimed ?? false)
        : (options.left ?? 257_005n * 10n ** 18n),
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
    priceUsd: async () => 3,
    gasCostUsd: async () => 0.2,
    fetchJson: async (url: string) => {
      if (!(url in files)) throw new Error(`404 ${url}`);
      return files[url];
    },
    ...overrides,
  };
}

describe('uni-2020 check', () => {
  it('finds unclaimed UNI, verified against the root, with the measured claim gas', async () => {
    const readContract = vi.fn(async ({ functionName }: ReadRequest) =>
      functionName === 'isClaimed' ? false : 257_005n * 10n ** 18n,
    );
    const priceUsd = vi.fn(async () => 3);
    const gasCostUsd = vi.fn(async () => 0.2);
    const outcome = await uni2020Check.check(
      ONE,
      fakeContext({}, { readContract, priceUsd, gasCostUsd }),
    );

    expect(outcome).toEqual({
      kind: 'found',
      findings: [
        {
          title: 'UNI from the 2020 Uniswap airdrop, never claimed',
          network: 'ethereum',
          amount: { raw: ONE_AMOUNT, decimals: 18, symbol: 'UNI' },
          valueUsd: expect.closeTo((Number(ONE_AMOUNT) / 1e18) * 3, 6),
          claimCostUsd: 0.2,
          deadline: null,
          heldBy: DISTRIBUTOR,
          note: expect.stringContaining('always goes to your wallet'),
        },
      ],
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: DISTRIBUTOR, functionName: 'isClaimed', args: [1n] }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ to: UNI, functionName: 'balanceOf', args: [DISTRIBUTOR] }),
    );
    expect(priceUsd).toHaveBeenCalledWith('ethereum', UNI);
    expect(gasCostUsd).toHaveBeenCalledWith('ethereum', 84_000n);
  });

  it('matches the address whatever its case', async () => {
    const outcome = await uni2020Check.check(ONE.toUpperCase().replace('0X', '0x'), fakeContext());
    expect(outcome.kind).toBe('found');
  });

  it('says already claimed when the index is marked claimed', async () => {
    expect(await uni2020Check.check(ONE, fakeContext({ claimed: true }))).toEqual({
      kind: 'nothing',
      alreadyClaimed: true,
    });
  });

  it('reports lost when the distributor cannot pay the claim', async () => {
    const outcome = await uni2020Check.check(ONE, fakeContext({ left: ONE_AMOUNT - 1n }));
    expect(outcome).toMatchObject({ kind: 'lost' });
  });

  it('reports the zero address entry as lost: UNI refuses that transfer', async () => {
    expect(await uni2020Check.check(ZERO, fakeContext())).toMatchObject({ kind: 'lost' });
  });

  it('returns nothing for an address outside every chunk, without reading the chain', async () => {
    const readContract = vi.fn();
    const outcome = await uni2020Check.check(
      '0xf4d3591fe22333aecddd1be328a892904ee72593',
      fakeContext({}, { readContract }),
    );
    expect(outcome).toEqual({ kind: 'nothing' });
    expect(readContract).not.toHaveBeenCalled();
  });

  it('returns nothing for an address inside a chunk range but not in the chunk', async () => {
    const outcome = await uni2020Check.check(
      '0x0000000000000000000000000000000000000002',
      fakeContext(),
    );
    expect(outcome).toEqual({ kind: 'nothing' });
  });

  it('refuses data whose proof does not match the on-chain root', async () => {
    const tampered = { ...CHUNK, [ONE]: { ...ENTRY_ONE, amount: '0x0144a4e34076250ab001' } };
    const outcome = await uni2020Check.check(
      ONE,
      fakeContext({
        files: { [`${DATA}mapping.json`]: MAPPING, [`${DATA}${ZERO}.json`]: tampered },
      }),
    );
    expect(outcome).toMatchObject({ kind: 'error' });
  });

  it('reports an error when the list cannot be loaded, not nothing', async () => {
    expect(await uni2020Check.check(ONE, fakeContext({ files: {} }))).toMatchObject({
      kind: 'error',
    });
  });

  it('reports an error for a malformed entry or mapping', async () => {
    const badEntry = { ...CHUNK, [ONE]: { index: 1, amount: 'lots', proof: [] } };
    expect(
      await uni2020Check.check(
        ONE,
        fakeContext({
          files: { [`${DATA}mapping.json`]: MAPPING, [`${DATA}${ZERO}.json`]: badEntry },
        }),
      ),
    ).toMatchObject({ kind: 'error' });
    expect(
      await uni2020Check.check(ONE, fakeContext({ files: { [`${DATA}mapping.json`]: [1, 2] } })),
    ).toMatchObject({ kind: 'error' });
  });

  it('never reads a broken mapping or chunk as "not eligible"', async () => {
    const outside = '0xf4d3591fe22333aecddd1be328a892904ee72593';
    const withFiles = (mapping: unknown, chunk?: unknown) =>
      fakeContext({
        files: {
          [`${DATA}mapping.json`]: mapping,
          ...(chunk === undefined ? {} : { [`${DATA}${ZERO}.json`]: chunk }),
        },
      });
    const [firstRange] = Object.entries(MAPPING);
    const overlapping = {
      ...MAPPING,
      '0x0001000000000000000000000000000000000000': firstRange![1],
    };

    expect(await uni2020Check.check(outside, withFiles({}))).toMatchObject({ kind: 'error' });
    expect(await uni2020Check.check(outside, withFiles(overlapping))).toMatchObject({
      kind: 'error',
    });
    expect(await uni2020Check.check(ONE, withFiles(MAPPING, {}))).toMatchObject({ kind: 'error' });
    // A chunk whose entries are broken or do not match the root, asked about another address.
    expect(
      await uni2020Check.check(
        '0x0000000000000000000000000000000000000002',
        withFiles(MAPPING, { [ZERO]: null }),
      ),
    ).toMatchObject({ kind: 'error' });
    expect(
      await uni2020Check.check(
        '0x0000000000000000000000000000000000000002',
        withFiles(MAPPING, { ...CHUNK, [ONE]: { ...ENTRY_ONE, amount: '0x01' } }),
      ),
    ).toMatchObject({ kind: 'error' });
    expect(await uni2020Check.check(ONE, withFiles(MAPPING, { [ONE]: ENTRY_ONE }))).toMatchObject({
      kind: 'error',
    });
  });

  it('reports an error for an unexpected contract response', async () => {
    expect(await uni2020Check.check(ONE, fakeContext({ claimed: '0x' }))).toMatchObject({
      kind: 'error',
    });
  });

  it('still reports the UNI when no price is known', async () => {
    const outcome = await uni2020Check.check(ONE, fakeContext({}, { priceUsd: async () => null }));
    expect(outcome).toMatchObject({ kind: 'found', findings: [{ valueUsd: null }] });
  });

  it('rejects an invalid address without loading anything', async () => {
    const fetchJson = vi.fn();
    const outcome = await uni2020Check.check('0x1234', fakeContext({}, { fetchJson }));
    expect(outcome).toMatchObject({ kind: 'error' });
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
