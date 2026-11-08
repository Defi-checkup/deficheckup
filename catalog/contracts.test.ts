import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { isEvmAddress, isSolanaAddress } from '@deficheckup/engine';
import { checks } from './index';
import { utcDay } from './deadlines';
import { evmContracts } from './shared/contracts';

describe('maintenance metadata', () => {
  it('records explicit deadlines without confusing shutdowns or reward end dates with recovery', () => {
    for (const check of checks) {
      expect(check.deadline === null || Number.isInteger(utcDay(check.deadline))).toBe(true);
      if (check.status.kind === 'closing') expect(check.deadline).toBe(check.status.deadline);
      expect(Number.isInteger(utcDay(check.verifiedOn))).toBe(true);
    }
  });

  it('keeps inventories valid, unique and on the check networks', () => {
    for (const check of checks) {
      const keys = check.contracts.map(({ network, address }) => {
        expect(check.networks).toContain(network);
        expect(network === 'solana' ? isSolanaAddress(address) : isEvmAddress(address)).toBe(true);
        expect(address).not.toBe('0x0000000000000000000000000000000000000000');
        return `${network}:${network === 'solana' ? address : address.toLowerCase()}`;
      });
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('covers every fixed EVM address literal in production catalog modules, including shared tokens', () => {
    // Parse strings, not comments: source citations and on-chain event owners are not read targets.
    // No tests, fixtures, guides or live wallet addresses enter the network inventory.
    const inventory = new Set(
      checks.flatMap((check) =>
        check.contracts.map(({ network, address }) => `${network}:${address.toLowerCase()}`),
      ),
    );
    const folders = [...checks.map(({ id }) => id), 'shared'];
    for (const folder of folders) {
      const network =
        folder === 'shared' ? 'ethereum' : checks.find(({ id }) => id === folder)!.networks[0]!;
      const dir = new URL(`./${folder}/`, import.meta.url);
      for (const file of readdirSync(dir).filter(
        (name) => name.endsWith('.ts') && !/\.(test|live)\.ts$/.test(name),
      )) {
        const source = ts.createSourceFile(
          file,
          readFileSync(new URL(file, dir), 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node: ts.Node) {
          if (ts.isStringLiteral(node) && isEvmAddress(node.text) && !/^0x0{40}$/.test(node.text))
            expect(
              inventory.has(`${network}:${node.text.toLowerCase()}`),
              `${folder}/${file}: ${node.text}`,
            ).toBe(true);
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  });

  it('deduplicates addresses case-insensitively and excludes the native-token marker', () => {
    const address = checks.find(({ id }) => id === 'safe-locking')!.contracts[0]!
      .address as `0x${string}`;
    expect(
      evmContracts('ethereum', address, address.toLowerCase() as `0x${string}`, 'native'),
    ).toHaveLength(1);
  });
});
