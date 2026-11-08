// Talks to real RPCs and DefiLlama. Never runs in CI: run it by hand with `pnpm test:live`.
import { createPublicClient, http } from 'viem';
import { describe, expect, it } from 'vitest';
import { createCheckContext } from './context';
import { createEnsResolver } from './inputs';
import { EVM_NETWORKS, type EvmNetwork } from './networks';
import { runChecks } from './run';
import type { Check, CheckOutcome } from './types';

const getChainIdAbi = [
  {
    type: 'function',
    name: 'getChainId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'chainid', type: 'uint256' }],
  },
] as const;

const networks = Object.keys(EVM_NETWORKS) as EvmNetwork[];

function multicallOf(network: EvmNetwork) {
  const address = EVM_NETWORKS[network].chain.contracts?.multicall3?.address;
  if (!address) throw new Error(`${network} has no Multicall3 in viem`);
  return address;
}

// Well-known public tokens, used only to confirm each price key answers (checked 2026-11-01).
const PRICED_TOKENS: Record<EvmNetwork, string> = {
  ethereum: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  optimism: '0x4200000000000000000000000000000000000006', // WETH
  base: '0x4200000000000000000000000000000000000006', // WETH
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WPOL
  gnosis: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
  zksync: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', // WETH
  linea: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f', // WETH
  scroll: '0x5300000000000000000000000000000000000004', // WETH
  blast: '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad', // BLAST (DefiLlama has no WETH price here)
  mantle: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', // WMNT
  celo: '0x471EcE3750Da237f93B8E339c536989b8978a438', // CELO
  'flow-evm': '0xd3bF53DAC106A0290B0483EcBC89d40FcC961f3e', // WFLOW
};

const multicallViewsAbi = [
  ...getChainIdAbi,
  ...(['getBlockNumber', 'getCurrentBlockTimestamp'] as const).map((name) => ({
    type: 'function' as const,
    name,
    stateMutability: 'view' as const,
    inputs: [],
    outputs: [{ name: '', type: 'uint256' as const }],
  })),
];

describe('live context', () => {
  it('sends three different reads as one Multicall3 request', async () => {
    type RpcCall = { method: string; params?: [{ to?: string }] };
    const calls: Promise<RpcCall>[] = [];
    const ctx = createCheckContext({
      // Returns the new array length on purpose: the engine must ignore listener results.
      onRpcRequest: (_network, request) => calls.push(request.clone().json() as Promise<RpcCall>),
    });
    const to = multicallOf('ethereum');

    const answers = await Promise.all(
      ['getChainId', 'getBlockNumber', 'getCurrentBlockTimestamp'].map((functionName) =>
        ctx.readContract({ network: 'ethereum', to, abi: multicallViewsAbi, functionName }),
      ),
    );
    const ethCalls = (await Promise.all(calls)).filter((call) => call.method === 'eth_call');

    expect(answers[0]).toBe(1n);
    expect(ethCalls).toHaveLength(1);
    expect(ethCalls[0]?.params?.[0].to?.toLowerCase()).toBe(to.toLowerCase());
  });

  it('sends a read by selector in the same Multicall3 request as a named read', async () => {
    type RpcCall = { method: string };
    const calls: Promise<RpcCall>[] = [];
    const ctx = createCheckContext({
      onRpcRequest: (_network, request) => {
        calls.push(request.clone().json() as Promise<RpcCall>);
      },
    });
    // A Koi farm on zkSync Era whose source is not published. 0x64c73e00(address) lists the stakes
    // of a wallet, 8 numbers each (read on 2026-11-01 for a public staker of 2025).
    const [stakes, chainId] = await Promise.all([
      ctx.readSelector({
        network: 'zksync',
        to: '0xe5095A9d6fe9573722706062EAafaE422134cd33',
        selector: '0x64c73e00',
        inputs: [{ type: 'address' }],
        args: ['0x65d4eF0a2F0b8E7A1AB3817612bB1653b38eaecF'],
        outputs: [{ type: 'uint256[8][]' }],
      }),
      ctx.readContract({
        network: 'zksync',
        to: multicallOf('zksync'),
        abi: getChainIdAbi,
        functionName: 'getChainId',
      }),
    ]);
    const ethCalls = (await Promise.all(calls)).filter((call) => call.method === 'eth_call');

    expect(chainId).toBe(324n);
    expect(Array.isArray(stakes[0])).toBe(true);
    expect(ethCalls).toHaveLength(1);
  });

  it.each(networks)('%s answers reads with its own chain id', async (network) => {
    const ctx = createCheckContext();
    const read = () =>
      ctx.readContract({
        network,
        to: multicallOf(network),
        abi: getChainIdAbi,
        functionName: 'getChainId',
      });

    const answers = await Promise.all([read(), read(), read()]);

    expect(answers).toEqual(Array(3).fill(BigInt(EVM_NETWORKS[network].chain.id)));
  });

  it.each(networks)('%s has token and native prices, and a gas cost', async (network) => {
    const ctx = createCheckContext();

    expect(await ctx.priceUsd(network, PRICED_TOKENS[network])).toBeGreaterThan(0);
    expect(await ctx.priceUsd(network, 'native')).toBeGreaterThan(0);
    expect(await ctx.gasCostUsd(network, 100_000n)).toBeGreaterThan(0);
  });

  it.each(networks)('%s reads a native balance equal to eth_getBalance', async (network) => {
    const ctx = createCheckContext();
    const { chain, rpcs } = EVM_NETWORKS[network];
    const direct = createPublicClient({ chain, transport: http(rpcs[0]) });
    // The zero address holds burned native coins on most networks and rarely moves.
    const holder = '0x0000000000000000000000000000000000000000';

    const [viaMulticall, viaRpc] = await Promise.all([
      ctx.nativeBalance(network, holder),
      direct.getBalance({ address: holder }),
    ]);
    expect(viaMulticall).toBe(viaRpc);
  });

  // Claim costs leave out the L1 data fee of rollups. Measured on 2026-11-01 with 1,500 bytes that
  // do not compress (a Merkl claim with a long proof is about that size; OP Stack and Scroll
  // compress what they post): zero on Arbitrum and Celo, thousandths of a cent on the OP Stack
  // networks, and $0.0063 on Scroll, the closest to the limit. If blob prices climb this fails, and
  // the fee has to be added to gasCostUsd. zkSync Era and Linea charge it inside the gas price.
  const L1_FEE_LIMIT_USD = 0.01;
  const TX_BYTES = 1_500;
  // Fixed pseudo-random bytes (xorshift32), so every run measures the same payload.
  const payload = (() => {
    let x = 2_463_534_242;
    const bytes = Array.from({ length: TX_BYTES }, () => {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return (x & 255).toString(16).padStart(2, '0');
    });
    return `0x${bytes.join('')}` as const;
  })();
  const getL1FeeAbi = [
    {
      type: 'function',
      name: 'getL1Fee',
      stateMutability: 'view',
      inputs: [{ name: 'data', type: 'bytes' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const;
  const getPricesInWeiAbi = [
    {
      type: 'function',
      name: 'getPricesInWei',
      stateMutability: 'view',
      inputs: [],
      outputs: Array.from({ length: 6 }, () => ({ name: '', type: 'uint256' })),
    },
  ] as const;
  const L1_FEE_ORACLES: Partial<Record<EvmNetwork, `0x${string}`>> = {
    optimism: '0x420000000000000000000000000000000000000F', // OP Stack GasPriceOracle
    base: '0x420000000000000000000000000000000000000F',
    blast: '0x420000000000000000000000000000000000000F',
    mantle: '0x420000000000000000000000000000000000000F',
    celo: '0x420000000000000000000000000000000000000F',
    scroll: '0x5300000000000000000000000000000000000002', // Scroll L1GasPriceOracle
  };

  it.each([...Object.keys(L1_FEE_ORACLES), 'arbitrum'] as EvmNetwork[])(
    '%s charges under a cent of L1 data fee for a claim',
    async (network) => {
      const ctx = createCheckContext();
      let feeWei: bigint;
      if (network === 'arbitrum') {
        // ArbGasInfo: a fixed price per transaction plus a price per byte posted to L1.
        const prices = (await ctx.readContract({
          network,
          to: '0x000000000000000000000000000000000000006C',
          abi: getPricesInWeiAbi,
          functionName: 'getPricesInWei',
        })) as readonly bigint[];
        feeWei = prices[0]! + prices[1]! * BigInt(TX_BYTES);
      } else {
        feeWei = (await ctx.readContract({
          network,
          to: L1_FEE_ORACLES[network]!,
          abi: getL1FeeAbi,
          functionName: 'getL1Fee',
          args: [payload],
        })) as bigint;
      }
      const nativePrice = await ctx.priceUsd(network, 'native');

      expect(nativePrice).toBeGreaterThan(0);
      expect((Number(feeWei) / 1e18) * nativePrice!).toBeLessThan(L1_FEE_LIMIT_USD);
    },
  );

  it('resolves a public ENS name', async () => {
    const resolve = createEnsResolver();

    expect(await resolve('vitalik.eth')).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(await resolve('this-name-should-not-exist-deficheckup-2026.eth')).toBeNull();
  });

  // Milestone M2 goal: one test check across 15 networks in under 10 seconds.
  it('runs one check across all 15 networks in under 10 seconds', async () => {
    const acrossAllNetworks: Check = {
      id: 'all-networks',
      name: 'Reads every network',
      networks,
      category: 'forgotten-position',
      status: { kind: 'open' },
      officialLink: 'https://example.com',
      deadline: null,
      contracts: [],
      verifiedOn: '2026-11-01',
      async check(_address, ctx): Promise<CheckOutcome> {
        const ids = await Promise.all(
          networks.map((network) =>
            ctx.readContract({
              network,
              to: multicallOf(network),
              abi: getChainIdAbi,
              functionName: 'getChainId',
            }),
          ),
        );
        const right = networks.every(
          (network, i) => ids[i] === BigInt(EVM_NETWORKS[network].chain.id),
        );
        return right ? { kind: 'nothing' } : { kind: 'error', reason: 'A network answered wrong.' };
      },
    };

    const start = performance.now();
    const { runs } = await runChecks(
      [acrossAllNetworks],
      ['0x000000000000000000000000000000000000dEaD'],
      createCheckContext(),
    );
    const seconds = (performance.now() - start) / 1000;
    console.log(`15 networks in ${seconds.toFixed(2)} s`);

    expect(networks).toHaveLength(15);
    expect(runs[0]?.outcome).toEqual({ kind: 'nothing' });
    expect(seconds).toBeLessThan(10);
  });
});
