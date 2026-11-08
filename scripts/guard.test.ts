import { spawnSync } from 'node:child_process';
import { symlinkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const GUARD = join(import.meta.dirname, 'guard.mjs');
const FAKE_WALLET = '0x1111111111111111111111111111111111111111';
const FAKE_NAME = 'zz9-test';
// Built from code points: written as literals, this file would flag itself.
const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);

const dirs: string[] = [];

/** A throwaway git repo, with a denylist outside of it that holds FAKE_WALLET. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'guard-'));
  dirs.push(dir);
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  spawnSync('git', ['init', '-q'], { cwd: repo });

  const denylistPath = join(dir, 'denylist.txt');
  writeFileSync(denylistPath, `# mine\n${FAKE_WALLET}\nname:${FAKE_NAME}\n`);

  return {
    write(name: string, content: string | Buffer) {
      mkdirSync(dirname(join(repo, name)), { recursive: true });
      writeFileSync(join(repo, name), content);
    },
    stage(name: string) {
      spawnSync('git', ['add', name], { cwd: repo });
    },
    run({ denylist = true, ci = false } = {}) {
      return spawnSync('node', [GUARD], {
        cwd: repo,
        encoding: 'utf8',
        env: {
          ...process.env,
          CI: ci ? 'true' : '',
          DEFICHECKUP_DENYLIST: denylist ? denylistPath : join(dir, 'missing.txt'),
        },
      });
    },
  };
}

function guardOn(content: string | Buffer) {
  const repo = makeRepo();
  repo.write('notes.md', content);
  return repo.run();
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('guard: dashes', () => {
  it('passes clean text', () => {
    expect(guardOn('Plain text, a colon: and a hyphen - fine.\n').status).toBe(0);
  });

  it('blocks an em dash and an en dash', () => {
    const emDash = guardOn(`one ${EM_DASH} two\n`);

    expect(emDash.status).toBe(1);
    expect(emDash.stderr).toContain('notes.md:1');
    expect(guardOn(`one ${EN_DASH} two\n`).status).toBe(1);
  });
});

describe('guard: wallet names', () => {
  it('blocks a wallet name as a whole word, in any case, without printing it', () => {
    const result = guardOn(`fees like ${FAKE_NAME.toUpperCase()}-sized ones\n`);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('wallet name on denylist line 3');
    expect(result.stderr.toLowerCase()).not.toContain(FAKE_NAME);
  });

  it('lets a longer word that only contains the name through', () => {
    expect(guardOn(`${FAKE_NAME}0 and x${FAKE_NAME}\n`).status).toBe(0);
  });

  it('blocks a wallet name in a file name, without printing it', () => {
    const repo = makeRepo();
    repo.write(`${FAKE_NAME}.md`, 'clean\n');
    const result = repo.run();

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`.toLowerCase()).not.toContain(FAKE_NAME);
  });

  it('finds a wallet name in UTF-16 text without a BOM that looks binary', () => {
    const text = `${'漢'.repeat(256)} ${FAKE_NAME}`;

    expect(guardOn(Buffer.from(text, 'utf16le')).status).toBe(1);
    expect(guardOn(Buffer.from(text, 'utf16le').swap16()).status).toBe(1);
  });

  it('does not look for names inside binary files', () => {
    expect(guardOn(Buffer.from([0, 1, 2, ...Buffer.from(` ${FAKE_NAME} `), 0, 255])).status).toBe(
      0,
    );
  });
});

describe('guard: wallets', () => {
  it('blocks a denylisted wallet in any letter case, without printing it', () => {
    const result = guardOn(`wallet ${FAKE_WALLET.toUpperCase()}\n`);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('denylist line 2');
    expect(result.stderr.toLowerCase()).not.toContain(FAKE_WALLET);
  });

  it('blocks an abbreviated copy that keeps the start of the wallet', () => {
    expect(guardOn('see 0x11111111...1111\n').status).toBe(1);
  });

  it('lets other wallets through', () => {
    expect(guardOn('wallet 0x2222222222222222222222222222222222222222\n').status).toBe(0);
  });

  it('checks the staged version, not only the file on disk', () => {
    const repo = makeRepo();
    repo.write('notes.md', `wallet ${FAKE_WALLET}\n`);
    repo.stage('notes.md');
    repo.write('notes.md', 'cleaned on disk, but the commit would still carry it\n');

    const result = repo.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('notes.md (staged):1');
  });

  it('blocks a wallet in a file name', () => {
    const repo = makeRepo();
    repo.write(`fixtures/${FAKE_WALLET}.json`, '{}\n');

    const result = repo.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('(file name)');
    expect(result.stderr.toLowerCase()).not.toContain(FAKE_WALLET);
  });

  it('checks the lockfile for wallets even though dashes are allowed there', () => {
    const repo = makeRepo();
    repo.write('pnpm-lock.yaml', `# ${EM_DASH} fine here\n# ${FAKE_WALLET}\n`);

    const result = repo.run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('pnpm-lock.yaml:2');
    expect(result.stderr).not.toContain('pnpm-lock.yaml:1');
  });

  it('reads UTF-16 files, with and without BOM', () => {
    const text = `{"wallet": "${FAKE_WALLET}"}\n`;
    const withBom = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);

    expect(guardOn(withBom).status).toBe(1);
    expect(guardOn(Buffer.from(text, 'utf16le')).status).toBe(1);
  });

  it('checks the staged version of a file whose name has a newline', () => {
    const repo = makeRepo();
    repo.write('notes\nprivate.txt', `wallet ${FAKE_WALLET}\n`);
    repo.stage('notes\nprivate.txt');
    repo.write('notes\nprivate.txt', 'cleaned on disk\n');

    expect(repo.run().status).toBe(1);
  });

  it('finds a wallet after bytes that make the file look like UTF-16', () => {
    expect(guardOn(Buffer.concat([Buffer.alloc(512), Buffer.from(FAKE_WALLET)])).status).toBe(1);
  });

  it('finds a wallet in UTF-16 text that looks binary', () => {
    const text = `${'漢'.repeat(256)} ${FAKE_WALLET}`;

    expect(guardOn(Buffer.from(text, 'utf16le')).status).toBe(1);
    expect(guardOn(Buffer.from(text, 'utf16le').swap16()).status).toBe(1);
  });

  it('finds a wallet hidden in a binary file', () => {
    const binary = Buffer.concat([Buffer.from([0, 1, 2, 0, 255]), Buffer.from(FAKE_WALLET)]);

    expect(guardOn(binary).status).toBe(1);
  });

  it('checks optimized guide WebPs on disk and in the index without image exemptions', () => {
    const image = readFileSync(new URL('../web/src/assets/guide-art/cream.webp', import.meta.url));
    const repo = makeRepo();
    const path = 'web/src/assets/guide-art/cream.webp';
    repo.write(path, image);
    expect(repo.run().status).toBe(0);
    repo.write(path, Buffer.concat([image, Buffer.from(FAKE_WALLET)]));
    expect(repo.run().status).toBe(1);
    repo.stage(path);
    repo.write(path, image);
    expect(repo.run().status).toBe(1);
  });
});

describe('guard: denylist', () => {
  it('blocks the commit when the denylist is missing', () => {
    const repo = makeRepo();
    repo.write('notes.md', 'clean\n');

    const result = repo.run({ denylist: false });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no usable wallet denylist');
  });

  it('runs only the dash rule in CI, where there is no denylist', () => {
    const repo = makeRepo();
    repo.write('notes.md', 'clean\n');

    const result = repo.run({ denylist: false, ci: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('only the dash rule runs');
  });
});

describe('guard: snapshot without git', () => {
  function snapshot() {
    const dir = mkdtempSync(join(tmpdir(), 'guard-snapshot-'));
    dirs.push(dir);
    const root = join(dir, 'copy');
    mkdirSync(root);
    const denylist = join(dir, 'denylist.txt');
    writeFileSync(denylist, `${FAKE_WALLET}\nname:${FAKE_NAME}\n`);
    const run = (ci = false, list = denylist) =>
      spawnSync('node', [GUARD, '--snapshot', root], {
        encoding: 'utf8',
        env: { ...process.env, CI: ci ? 'true' : '', DEFICHECKUP_DENYLIST: list },
      });
    return { root, run, dir };
  }
  it('checks all nested files without a repository or ignore exemptions', () => {
    const { root, run } = snapshot();
    mkdirSync(join(root, 'ignored'));
    writeFileSync(join(root, '.gitignore'), 'ignored/\n');
    writeFileSync(join(root, 'ignored', 'data.txt'), 'clean');
    expect(run().status).toBe(0);
    writeFileSync(join(root, 'ignored', 'data.txt'), FAKE_WALLET);
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain(FAKE_WALLET);
  });
  it('checks committed WebP sources in the exported snapshot', () => {
    const { root, run } = snapshot();
    const directory = join(root, 'web/src/assets/guide-art');
    mkdirSync(directory, { recursive: true });
    const image = readFileSync(new URL('../web/src/assets/guide-art/cream.webp', import.meta.url));
    writeFileSync(join(directory, 'cream.webp'), image);
    expect(run().status).toBe(0);
    writeFileSync(join(directory, 'cream.webp'), Buffer.concat([image, Buffer.from(FAKE_WALLET)]));
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain(FAKE_WALLET);
  });
  it('requires a denylist even in CI and rejects symlinks and git metadata', () => {
    const { root, run, dir } = snapshot();
    expect(run(true, join(dir, 'missing')).status).toBe(1);
    symlinkSync(join(dir, 'denylist.txt'), join(root, 'link'));
    expect(run().status).toBe(1);
    rmSync(join(root, 'link'));
    mkdirSync(join(root, '.git'));
    expect(run().status).toBe(1);
  });
});
