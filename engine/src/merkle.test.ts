import { describe, expect, it } from 'vitest';
import { distributorLeaf, isHash32, verifyMerkleProof, type Hash32 } from './merkle';

// Uniswap's 2020 UNI airdrop: merkleRoot() of 0x090D4613473dEE047c3f2706764f49E0821D256e and the
// entry at index 0 from its published chunks (commit c215bf1e4360205acdc6c154389b10a2f287974d).
const ROOT = '0xc8500f8e2fcf3c9a32880e1b973fb28acc88be35787a8abcf9981b2b65dbdeb5';
const ACCOUNT = '0x0000000000000000000000000000000000000000';
const AMOUNT = 400n * 10n ** 18n;
const PROOF: Hash32[] = [
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
];

describe('merkle proofs', () => {
  it('accepts a real entry of the UNI airdrop against its on-chain root', () => {
    expect(verifyMerkleProof(distributorLeaf(0n, ACCOUNT, AMOUNT), PROOF, ROOT)).toBe(true);
  });

  it('rejects the same proof with another amount, index or account', () => {
    expect(verifyMerkleProof(distributorLeaf(0n, ACCOUNT, AMOUNT + 1n), PROOF, ROOT)).toBe(false);
    expect(verifyMerkleProof(distributorLeaf(1n, ACCOUNT, AMOUNT), PROOF, ROOT)).toBe(false);
    expect(
      verifyMerkleProof(
        distributorLeaf(0n, '0x0000000000000000000000000000000000000001', AMOUNT),
        PROOF,
        ROOT,
      ),
    ).toBe(false);
  });

  it('rejects a proof with one sibling missing', () => {
    expect(verifyMerkleProof(distributorLeaf(0n, ACCOUNT, AMOUNT), PROOF.slice(1), ROOT)).toBe(
      false,
    );
  });

  it('does not care about hex case', () => {
    const upper = PROOF.map((p) => `0x${p.slice(2).toUpperCase()}` as Hash32);
    expect(verifyMerkleProof(distributorLeaf(0n, ACCOUNT, AMOUNT), upper, ROOT)).toBe(true);
  });

  it('only takes 32-byte hashes', () => {
    const first = '0xb1bcfa5de1b8585bb7c22411cd0c7ee3ac895000053f72ed782d475d31b9c1ee';
    expect(isHash32(first)).toBe(true);
    expect(isHash32(first.slice(0, 65))).toBe(false);
    expect(isHash32(42)).toBe(false);
  });
});
