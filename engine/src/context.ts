import {
  concatHex,
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  fallback,
  http,
  type Abi,
  type AbiParameter,
  type Hex,
} from 'viem';
import { amountToNumber } from './amount';
import { EVM_NETWORKS, isEvmNetwork, type EvmNetwork } from './networks';
import type { CheckContext, Network, PriceQuote } from './types';

/** The two things the engine asks of an EVM network. viem's public client provides both. */
export interface EvmReader {
  readContract(args: {
    address: `0x${string}`;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  getGasPrice(): Promise<bigint>;
}

export interface ContextOptions {
  /**
   * Time limit for each RPC before moving to the next one. RPCs are tried one after another
   * and never retried: up to 3 RPCs x 2.5 s = 7.5 s for a read.
   */
  rpcTimeoutMs?: number;
  /**
   * Time limit for the optional estimates (a price, a claim cost). A late one becomes null.
   * Both price attempts, response parsing and the retry delay share this limit.
   * Read (7.5 s) plus estimates in parallel (2 s) stays inside the 10 s a check is allowed,
   * so a slow price can never turn a finding into a timeout.
   */
  estimateTimeoutMs?: number;
  /** Time limit for a public API request (fetchJson). */
  apiTimeoutMs?: number;
  /** Replaces the real RPC clients (tests). */
  readers?: Partial<Record<EvmNetwork, EvmReader>>;
  /** Replaces the global fetch used for prices (tests). */
  fetchFn?: typeof fetch;
  /** Base URL of our proxy, without a trailing slash. Without it, ctx.proxy rejects. */
  proxyUrl?: string;
  /** Sees every request sent to an RPC (tests and diagnostics). */
  onRpcRequest?: (network: EvmNetwork, request: Request) => void;
}

const PRICES_URL = 'https://coins.llama.fi/prices/current/';
const API_RETRY_DELAY_MS = 800;
const PRICE_RETRY_DELAY_MS = 200;

const getEthBalanceAbi = [
  {
    type: 'function',
    name: 'getEthBalance',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

// Multicall3's tryAggregate, declared as a view so a raw call travels as a read. viem merges it
// with the other reads of the same moment; it never merges aggregate3, which it treats as an
// already built multicall. With requireSuccess, a reverted call reverts, as readContract would.
const tryAggregateAbi = [
  {
    type: 'function',
    name: 'tryAggregate',
    stateMutability: 'view',
    inputs: [
      { name: 'requireSuccess', type: 'bool' },
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const;

/** Resolves with `late` when the promise takes longer than `ms`. */
function within<T>(promise: Promise<T>, ms: number, late: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(late), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * The real CheckContext. Create one per scan: reads made in the same moment on one network
 * are merged into a single Multicall3 request, and each price lookup is shared per scan.
 */
export function createCheckContext({
  rpcTimeoutMs = 2_500,
  estimateTimeoutMs = 2_000,
  apiTimeoutMs = 5_000,
  readers = {},
  fetchFn = fetch,
  proxyUrl,
  onRpcRequest,
}: ContextOptions = {}): CheckContext {
  const clients = new Map<EvmNetwork, EvmReader>();
  const prices = new Map<string, Promise<PriceQuote>>();
  const gasPrices = new Map<EvmNetwork, Promise<bigint | null>>();
  const apiAnswers = new Map<string, Promise<unknown>>();

  /** One eth_gasPrice per network per scan: Multicall3 cannot batch it, and every finding asks. */
  function gasPrice(network: EvmNetwork): Promise<bigint | null> {
    let cached = gasPrices.get(network);
    if (!cached) {
      cached = readerFor(network)
        .getGasPrice()
        .catch(() => {
          gasPrices.delete(network); // a failed request may be retried by the next finding
          return null; // an estimate that fails must not hide funds
        });
      gasPrices.set(network, cached);
    }
    return cached;
  }

  function readerFor(network: Network): EvmReader {
    if (!isEvmNetwork(network)) throw new Error(`No EVM reader for ${network}.`);

    const injected = readers[network];
    if (injected) return injected;

    let client = clients.get(network);
    if (!client) {
      const { chain, rpcs } = EVM_NETWORKS[network];
      const transports = rpcs.map((url) =>
        http(url, {
          timeout: rpcTimeoutMs,
          retryCount: 0,
          // viem treats a returned value as request changes, so the listener's result is dropped.
          onFetchRequest:
            onRpcRequest &&
            ((request) => {
              onRpcRequest(network, request);
            }),
        }),
      );
      client = createPublicClient({
        chain,
        transport: fallback(transports, { retryCount: 0 }),
        batch: { multicall: true },
      }) as EvmReader;
      clients.set(network, client);
    }
    return client;
  }

  async function fetchPrice(id: string, signal: AbortSignal): Promise<PriceQuote> {
    const response = await fetchFn(PRICES_URL + id, {
      signal,
    });
    if (response.status !== 200) throw new Error(`Price request failed with ${response.status}.`);
    const body: unknown = await response.json();
    const record = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);
    if (!record(body) || !record(body.coins)) throw new Error('Invalid price response.');
    if (!Object.hasOwn(body.coins, id)) return { status: 'unknown', usd: null };
    const coin = body.coins[id];
    if (
      !record(coin) ||
      typeof coin.price !== 'number' ||
      !Number.isFinite(coin.price) ||
      coin.price < 0
    )
      throw new Error('Invalid token price.');
    return { status: 'known', usd: coin.price };
  }

  async function priceWithRetry(id: string): Promise<PriceQuote> {
    const unavailable: PriceQuote = { status: 'unavailable', usd: null };
    // Both attempts, including the delay and body parsing, share the existing estimate budget.
    const delay = Math.min(PRICE_RETRY_DELAY_MS, estimateTimeoutMs / 10);
    const attemptMs = (estimateTimeoutMs - delay) / 2;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      let quote: PriceQuote;
      try {
        quote = await within(
          fetchPrice(id, controller.signal).catch(() => unavailable),
          attemptMs,
          unavailable,
        );
      } finally {
        controller.abort();
      }
      if (quote.status !== 'unavailable') return quote;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return unavailable;
  }

  function price(id: string): Promise<PriceQuote> {
    let cached = prices.get(id);
    if (!cached) {
      cached = priceWithRetry(id);
      prices.set(id, cached);
    }
    return cached;
  }

  function lookupPrice(network: Network, token: string): Promise<PriceQuote> {
    if (network === 'solana' && token === 'native') return price('coingecko:solana');
    if (!isEvmNetwork(network)) return Promise.resolve({ status: 'unknown', usd: null });
    const config = EVM_NETWORKS[network];
    return price(token === 'native' ? config.nativePriceId : `${config.priceChain}:${token}`);
  }

  async function priceUsd(network: Network, token: string): Promise<number | null> {
    return (await lookupPrice(network, token)).usd;
  }

  // The same request in one scan is sent once (a market list asked for by every wallet).
  function fetchJson(url: string, body?: unknown): Promise<unknown> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const key = `${url} ${payload ?? ''}`;
    let cached = apiAnswers.get(key);
    if (!cached) {
      const send = () =>
        fetchFn(url, {
          method: payload === undefined ? 'GET' : 'POST',
          headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
          body: payload,
          signal: AbortSignal.timeout(apiTimeoutMs),
        });
      cached = (async () => {
        let response = await send();
        if (response.status === 429) {
          // Rate limited: public APIs free up within a moment, so wait once and try again.
          await new Promise((resolve) => setTimeout(resolve, API_RETRY_DELAY_MS));
          response = await send();
        }
        if (!response.ok) throw new Error(`Request failed with ${response.status}.`);
        return response.json() as Promise<unknown>;
      })();
      cached.catch(() => apiAnswers.delete(key)); // a failure may be retried
      apiAnswers.set(key, cached);
    }
    return cached;
  }

  return {
    readContract: ({ network, to, abi, functionName, args }) =>
      readerFor(network).readContract({ address: to, abi: abi as Abi, functionName, args }),

    async readSelector({ network, to, selector, inputs, args, outputs }) {
      if (!/^0x[0-9a-fA-F]{8}$/.test(selector))
        throw new Error(`Not a 4-byte selector: ${selector}`);
      if (!isEvmNetwork(network)) throw new Error(`No EVM reader for ${network}.`);
      const multicall = EVM_NETWORKS[network].chain.contracts?.multicall3?.address;
      if (!multicall) throw new Error(`No Multicall3 on ${network}.`);

      const callData = concatHex([
        selector as Hex,
        encodeAbiParameters(inputs as readonly AbiParameter[], args),
      ]);
      const results = await readerFor(network).readContract({
        address: multicall,
        abi: tryAggregateAbi,
        functionName: 'tryAggregate',
        args: [true, [{ target: to, callData }]],
      });
      const data = Array.isArray(results)
        ? (results[0] as { returnData?: unknown })?.returnData
        : null;
      if (typeof data !== 'string' || data === '0x') {
        throw new Error('Unexpected response from Multicall3.');
      }
      return decodeAbiParameters(outputs as readonly AbiParameter[], data as Hex);
    },

    async nativeBalance(network, address) {
      if (!isEvmNetwork(network)) throw new Error(`No EVM reader for ${network}.`);
      const multicall = EVM_NETWORKS[network].chain.contracts?.multicall3?.address;
      if (!multicall) throw new Error(`No Multicall3 on ${network}.`);

      const balance = await readerFor(network).readContract({
        address: multicall,
        abi: getEthBalanceAbi,
        functionName: 'getEthBalance',
        args: [address],
      });
      if (typeof balance !== 'bigint') throw new Error('Unexpected response from Multicall3.');
      return balance;
    },

    priceUsd,
    lookupPrice,

    fetchJson,

    proxy(route, body) {
      if (!proxyUrl) return Promise.reject(new Error('No proxy configured.'));
      return fetchJson(`${proxyUrl}/${route}`, body);
    },

    async solanaRpc(method, params) {
      if (!proxyUrl) throw new Error('No proxy configured.');
      const answer = await fetchJson(`${proxyUrl}/solana`, { method, params });
      if (typeof answer !== 'object' || answer === null || !Object.hasOwn(answer, 'result')) {
        throw new Error('Unexpected Solana RPC answer.');
      }
      return (answer as { result: unknown }).result;
    },

    gasCostUsd(network, gasUnits) {
      if (!isEvmNetwork(network)) return Promise.resolve(null);

      const estimate = async () => {
        const [price, nativePrice] = await Promise.all([
          gasPrice(network),
          priceUsd(network, 'native'),
        ]);
        if (price === null || nativePrice === null) return null;

        const { decimals, symbol } = EVM_NETWORKS[network].chain.nativeCurrency;
        return amountToNumber({ raw: price * gasUnits, decimals, symbol }) * nativePrice;
      };
      return within(estimate(), estimateTimeoutMs, null);
    },
  };
}
