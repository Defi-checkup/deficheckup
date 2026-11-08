/** A full EVM address: 0x followed by 40 hex characters. Never abbreviated. */
export type EvmAddress = `0x${string}`;

/** Networks a check can read. Add a value here when a protocol needs a new network. */
export type Network =
  | 'ethereum'
  | 'arbitrum'
  | 'optimism'
  | 'base'
  | 'polygon'
  | 'gnosis'
  | 'bsc'
  | 'avalanche'
  | 'zksync'
  | 'linea'
  | 'scroll'
  | 'blast'
  | 'mantle'
  | 'celo'
  | 'flow-evm'
  | 'solana'
  /** Hyperliquid's own chain (HyperCore), read through its public API. */
  | 'hyperliquid';

/** What kind of overlooked balance a check looks for. */
export type CheckCategory =
  | 'closed-network' // the network or app shut down, claims may still be open
  | 'unclaimed-airdrop'
  | 'forgotten-position' // a position in a protocol the user stopped visiting
  | 'rent'; // reclaimable account deposits (Solana)

/** Where the protocol stands today. Dates are ISO (YYYY-MM-DD). */
export type CheckStatus =
  | { kind: 'open' }
  | { kind: 'closing'; deadline: string }
  | { kind: 'closed-with-claim'; since: string }
  | { kind: 'expired'; since: string };

export interface TokenAmount {
  /** Smallest unit of the token, exactly as the contract reports it. */
  raw: bigint;
  decimals: number;
  symbol: string;
}

/** A valid response without this token is different from a failed price service request. */
export type PriceQuote =
  { status: 'known'; usd: number } | { status: 'unknown' | 'unavailable'; usd: null };

/** Funds the user can get back. */
export interface Finding {
  /** What the user has, in one line. */
  title: string;
  network: Network;
  amount: TokenAmount;
  /** Value in USD today, or null when no price is available. */
  valueUsd: number | null;
  /** Only set when valuation failed because the price service was unavailable. */
  priceStatus?: 'unavailable';
  /**
   * Estimated transaction fee in USD to get it out today, or null when unknown. EVM execution gas only:
   * the L1 data fee of rollups is left out because it measured under a cent on every rollup we
   * read (2026-11-01), and a live test fails when that stops being true.
   */
  claimCostUsd: number | null;
  /** Last day to claim (YYYY-MM-DD), or null when there is no deadline. */
  deadline: string | null;
  /** Holding contract or Solana account public key, in full, when it is not the user. */
  heldBy?: string;
  /**
   * What the user must know before claiming this one, in one or two sentences: a debt to repay
   * first, a market that cannot pay everything out today.
   */
  note?: string;
}

/** Proven non-empty position, without a decoded token amount or a claimed USD valuation. */
export type PositionFinding = Omit<Finding, 'amount' | 'valueUsd'> & {
  amount: null;
  valueUsd: null;
};
export type CheckFinding = Finding | PositionFinding;

export type CheckOutcome =
  /**
   * One finding per token, so a smart wallet holding three tokens gives three findings. `partial`
   * says why there may be more than what was found (a read failed, a list was too long to finish).
   */
  | {
      kind: 'found';
      findings: readonly [CheckFinding, ...CheckFinding[]];
      partial?: string;
      /**
       * With `partial`, all networks where this check could not finish. Other covered networks
       * completed. Omit if any affected network is unknown; never guess from the findings.
       */
      failedNetworks?: readonly Network[];
      /**
       * Facts about the same protocol that are not funds to claim (a debt another app shows as a
       * balance, rewards that cannot be paid), so a mixed result hides nothing.
       */
      notices?: readonly string[];
    }
  /** The position existed but cannot be recovered (hack, insolvent pool, expired claim). */
  | { kind: 'lost'; reason: string }
  /** Other wallet apps show a balance that is not real. */
  | { kind: 'fake'; reason: string }
  /** No recoverable funds now. `note` can explain active stake or a different close authority. */
  | { kind: 'nothing'; alreadyClaimed?: boolean; note?: string }
  | {
      kind: 'error';
      reason: string;
      /**
       * All networks where this check could not finish. Other covered networks completed.
       * Omit if any affected network is unknown.
       */
      failedNetworks?: readonly Network[];
    };

export interface ReadRequest {
  network: Network;
  to: EvmAddress;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

/**
 * A read of a contract whose source is not published, so the name of the function is unknown: it
 * is called by its 4-byte selector. `inputs` and `outputs` are ABI parameter lists, e.g.
 * `[{ type: 'address' }]`.
 */
export interface SelectorReadRequest {
  network: Network;
  to: EvmAddress;
  /** 0x followed by 8 hex characters, as found in the contract's bytecode. */
  selector: `0x${string}`;
  inputs: readonly unknown[];
  args: readonly unknown[];
  outputs: readonly unknown[];
}

/**
 * Everything a check may ask the outside world. The engine provides the real
 * implementation (RPC, prices, gas); tests provide a fake one with recorded data.
 */
export interface CheckContext {
  /** Calls a read-only contract function and returns the decoded result. */
  readContract(request: ReadRequest): Promise<unknown>;
  /**
   * Calls a read-only function by its selector and returns the decoded outputs, in order. Use it
   * only when the source is not published; it joins the same Multicall3 request as readContract.
   */
  readSelector(request: SelectorReadRequest): Promise<readonly unknown[]>;
  /**
   * Native balance (ETH, POL, BNB...) of any address, in the smallest unit. Read through
   * Multicall3, so it joins the other reads of the same moment in one request.
   */
  nativeBalance(network: Network, address: EvmAddress): Promise<bigint>;
  /** Price of one whole token in USD. `token` is a contract address or "native". */
  priceUsd(network: Network, token: string): Promise<number | null>;
  /** Rich price result. Optional for compatibility with existing contexts and recorded tests. */
  lookupPrice?(network: Network, token: string): Promise<PriceQuote>;
  /**
   * Cost in USD of spending this much execution gas on this network today, or null when it
   * cannot be estimated. Leaves out the L1 data fee of rollups (under a cent, see Finding).
   */
  gasCostUsd(network: Network, gasUnits: bigint): Promise<number | null>;
  /**
   * Calls a public JSON API that answers browsers (CORS open): POST with `body`, GET without it.
   * Rejects on a network error, a timeout or an answer that is not 2xx.
   */
  fetchJson(url: string, body?: unknown): Promise<unknown>;
  /**
   * Asks our proxy (proxy/ in this repo) for what a browser cannot fetch by itself: POSTs `body`
   * as JSON to the route. Rejects when no proxy is configured, on a network error or an answer
   * that is not 2xx. The address travels in the body, never in the URL.
   */
  proxy(route: ProxyRoute, body: Record<string, unknown>): Promise<unknown>;
  /** Read-only Solana JSON-RPC through the proxy's strict allowlist. Returns the result only. */
  solanaRpc(method: string, params: readonly unknown[]): Promise<unknown>;
}

/** The proxy's routes. */
export type ProxyRoute = 'zksync-lite' | 'safe' | 'solana';

/** A fixed contract or executable program, never a user's account. */
export type CatalogContract =
  | { network: Exclude<Network, 'solana' | 'hyperliquid'>; address: EvmAddress }
  | { network: 'solana'; address: string };

/** The mold every protocol follows. One folder per check in catalog/. */
export interface Check {
  /** Same as the folder name in catalog/. Lowercase letters, digits and hyphens. */
  id: string;
  name: string;
  networks: readonly Network[];
  category: CheckCategory;
  status: CheckStatus;
  /** Last day to recover funds (YYYY-MM-DD, UTC), retained after expiry. Null means none recorded. */
  deadline: string | null;
  /** Fixed contracts/programs used by this check. Never user wallets or dynamically found accounts. */
  contracts: readonly CatalogContract[];
  /** Official app or page where the user claims. Verified at the source. */
  officialLink: string;
  /** Date (YYYY-MM-DD) when contracts and links were last verified. */
  verifiedOn: string;
  /**
   * Looks for funds. A check has 10 s in total: start its reads together (they are merged into
   * one Multicall3 request per network) and ask for price and claim cost together afterwards.
   */
  check(address: string, ctx: CheckContext): Promise<CheckOutcome>;
}
