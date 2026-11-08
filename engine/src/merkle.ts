import { encodePacked, keccak256 } from 'viem';
import type { EvmAddress } from './types';

/** A 32-byte hash written as 0x followed by 64 hex characters. */
export type Hash32 = `0x${string}`;

const HASH32 = /^0x[0-9a-fA-F]{64}$/;

export function isHash32(value: unknown): value is Hash32 {
  return typeof value === 'string' && HASH32.test(value);
}

/**
 * Leaf of Uniswap's MerkleDistributor, which most airdrops since 2020 copied:
 * keccak256(abi.encodePacked(index, account, amount)).
 */
export function distributorLeaf(index: bigint, account: EvmAddress, amount: bigint): Hash32 {
  return keccak256(encodePacked(['uint256', 'address', 'uint256'], [index, account, amount]));
}

/**
 * Same rule as OpenZeppelin's MerkleProof.verify: each pair is hashed smaller value first. Lets a
 * check confirm that data from an outside file belongs to the root stored on-chain.
 */
export function verifyMerkleProof(leaf: Hash32, proof: readonly Hash32[], root: Hash32): boolean {
  let hash = leaf.toLowerCase() as Hash32;
  for (const sibling of proof) {
    const next = sibling.toLowerCase() as Hash32;
    hash =
      BigInt(hash) <= BigInt(next)
        ? keccak256(`${hash}${next.slice(2)}`)
        : keccak256(`${next}${hash.slice(2)}`);
  }
  return hash === root.toLowerCase();
}
