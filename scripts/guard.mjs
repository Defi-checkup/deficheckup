#!/usr/bin/env node
// Guards two project rules before anything is committed:
//   1. The maintainer's own wallets never enter the repo.
//   2. No em dashes or en dashes in any text.
//
// It checks what a commit would contain (the git index) and the working tree, including
// untracked files, file names and binary files.
//
// The wallet list lives outside the repo, one address per line (# starts a comment):
//   ~/.deficheckup/denylist.txt   (override with DEFICHECKUP_DENYLIST)
// A line `name:<label>` holds a name the maintainer gives a wallet in their notes. Names are matched
// as whole words in text and file names (not inside binary files, where short labels show up by chance).
// Without a usable list the guard fails, so a missing file can never let a wallet through.
// Only git-mode CI (CI=true, set by GitHub Actions) runs without it, with the dash rule alone.
// --snapshot <directory> inspects every exported file without git and always requires the list.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Built from code points: written as literals, this file would flag itself.
const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const FORBIDDEN_DASHES = [EM_DASH, EN_DASH];
// Third-party text: the dash rule does not apply, the wallet rule does.
const DASH_RULE_EXEMPT = new Set(['pnpm-lock.yaml']);

const inCI = process.env.CI === 'true' || process.env.CI === '1';
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--snapshot')) {
  console.error('Usage: node scripts/guard.mjs [--snapshot <directory>]');
  process.exit(1);
}
const snapshot = args[0] === '--snapshot';
const root = snapshot
  ? resolve(args[1])
  : execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/** An archive has no git index or ignore rules. Inspect every file and reject links and .git. */
function snapshotFiles(directory = root, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const file = prefix + name;
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (name === '.git' || stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
      console.error('guard: snapshot contains git metadata, a link or a special file.');
      process.exit(1);
    }
    return stat.isDirectory() ? snapshotFiles(path, `${file}/`) : [file];
  });
}

function git(args, input) {
  return execFileSync('git', args, { cwd: root, input, maxBuffer: 512 * 1024 * 1024 });
}

function listFiles(args) {
  return git(['ls-files', '-z', ...args])
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

/**
 * Content of every staged file, keyed by path, read with one `git cat-file --batch`.
 * Blobs are asked for by id, not by path, so any file name works (even one with a newline).
 */
function readIndex() {
  const entries = git(['ls-files', '--stage', '-z'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf('\t');
      return { path: entry.slice(tab + 1), oid: entry.slice(0, tab).split(' ')[1] };
    });
  const blobs = new Map();
  if (entries.length === 0) return blobs;

  const out = git(['cat-file', '--batch'], entries.map(({ oid }) => oid).join('\n') + '\n');
  let offset = 0;
  for (const { path } of entries) {
    const newline = out.indexOf(0x0a, offset);
    const header = out.subarray(offset, newline).toString('utf8');
    offset = newline + 1;
    if (header.endsWith(' missing')) continue;
    const size = Number(header.split(' ')[2]);
    blobs.set(path, out.subarray(offset, offset + size));
    offset += size + 1;
  }
  return blobs;
}

/**
 * Text of a file for the dash rule and for line numbers, or null when it looks binary.
 * The wallet rule does not depend on this guess: see walletViews().
 */
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xfe && buffer[1] === 0xff)
    return Buffer.from(buffer.subarray(2)).swap16().toString('utf16le');
  if (!buffer.includes(0)) return buffer.toString('utf8');

  // UTF-16 without BOM: one of every two bytes is zero in mostly-ASCII text.
  const sample = buffer.subarray(0, 512);
  let zeroOdd = 0;
  let zeroEven = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) i % 2 ? zeroOdd++ : zeroEven++;
  }
  const half = sample.length / 2;
  if (zeroOdd > half * 0.4 && buffer.length % 2 === 0) return buffer.toString('utf16le');
  if (zeroEven > half * 0.4 && buffer.length % 2 === 0) {
    return Buffer.from(buffer).swap16().toString('utf16le');
  }
  return null;
}

const denylistPath =
  process.env.DEFICHECKUP_DENYLIST ?? join(homedir(), '.deficheckup', 'denylist.txt');

/** Full address, plus its first characters so abbreviated copies are caught too. */
function needlesFor(entry) {
  const full = entry.toLowerCase();
  const prefixLength = full.startsWith('0x') ? 10 : 8;
  return [full, full.slice(0, prefixLength)];
}

const entries = existsSync(denylistPath)
  ? readFileSync(denylistPath, 'utf8')
      .split('\n')
      .map((line, index) => ({ entry: line.trim(), number: index + 1 }))
      .filter(({ entry }) => entry && !entry.startsWith('#'))
  : [];
const isName = ({ entry }) => entry.toLowerCase().startsWith('name:');
const denylist = entries
  .filter((e) => !isName(e))
  .map(({ entry, number }) => ({ number, needles: needlesFor(entry) }));
/** A name only counts as a whole word: `box-2` matches "box-2-sized" but not "box-20". */
const names = entries
  .filter(isName)
  .map(({ entry, number }) => ({ number, label: entry.slice(5).trim().toLowerCase() }))
  .filter(({ label }) => label)
  .map(({ number, label }) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      number,
      pattern: new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`),
      /** The same word, to hide it in anything the guard prints. */
      everywhere: new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'gi'),
    };
  });

if (denylist.length === 0) {
  if (!inCI || snapshot) {
    console.error(
      `guard: no usable wallet denylist at ${denylistPath}.\n` +
        'Create it (one address per line) so the wallet check can run. Commit blocked.',
    );
    process.exit(1);
  }
  console.log('guard: CI without a wallet denylist, only the dash rule runs.');
}

const problems = new Set();

function walletMatches(text) {
  const lower = text.toLowerCase();
  return denylist.filter(({ needles }) => needles.some((needle) => lower.includes(needle)));
}

function nameMatches(text) {
  const lower = text.toLowerCase();
  return names.filter(({ pattern }) => pattern.test(lower));
}

function reportNames(where, text) {
  for (const { number } of nameMatches(text)) {
    problems.add(
      `${where}: matches wallet name on denylist line ${number}. Wallet names never enter the repo.`,
    );
  }
}

function reportWallet(where, number) {
  problems.add(`${where}: matches wallet denylist line ${number}. Wallets never enter the repo.`);
}

function reportWallets(where, text) {
  for (const { number } of walletMatches(text)) reportWallet(where, number);
}

/** Every way the bytes could spell a wallet or a name: ASCII or UTF-8, and UTF-16 in both byte orders and alignments. */
function walletViews(buffer) {
  const views = [buffer.toString('latin1')];
  for (const start of [0, 1]) {
    const even = buffer.subarray(start, buffer.length - ((buffer.length - start) % 2));
    views.push(even.toString('utf16le'), Buffer.from(even).swap16().toString('utf16le'));
  }
  return views;
}

/** The path as it is safe to print: any denylisted wallet or wallet name inside it is hidden. */
function shown(file) {
  let safe = file;
  for (const { everywhere } of names) safe = safe.replace(everywhere, '$1[name]');
  for (const { needles } of denylist) {
    for (const needle of needles) {
      safe = safe.replace(
        new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[wallet]',
      );
    }
  }
  return safe;
}

function checkContent(file, label, buffer) {
  const name = `${shown(file)}${label}`;
  const found = new Set();

  const text = decode(buffer);
  if (text !== null) {
    text.split('\n').forEach((line, index) => {
      const where = `${name}:${index + 1}`;
      if (!DASH_RULE_EXEMPT.has(file) && FORBIDDEN_DASHES.some((dash) => line.includes(dash))) {
        problems.add(`${where}: em dash or en dash. Use a colon, comma, parentheses or a hyphen.`);
      }
      for (const { number } of walletMatches(line)) {
        found.add(number);
        reportWallet(where, number);
      }
      reportNames(where, line);
    });
  }

  // Whatever the file looked like, so no encoding or binary trick can hide a wallet. Names are
  // also looked for in the UTF-16 readings (UTF-16 text without a BOM can look binary), but not in
  // the raw bytes: a short name turns up by chance in images and other binary files.
  const foundNames = new Set(text === null ? [] : nameMatches(text).map(({ number }) => number));
  for (const [i, view] of walletViews(buffer).entries()) {
    for (const { number } of walletMatches(view)) {
      if (found.has(number)) continue;
      found.add(number);
      reportWallet(name, number);
    }
    if (i === 0) continue;
    for (const { number } of nameMatches(view)) {
      if (foundNames.has(number)) continue;
      foundNames.add(number);
      problems.add(
        `${name}: matches wallet name on denylist line ${number}. Wallet names never enter the repo.`,
      );
    }
  }
}

const staged = snapshot ? new Map() : readIndex();
const indexed = [...staged.keys()];
const untracked = snapshot ? snapshotFiles() : listFiles(['--others', '--exclude-standard']);

for (const file of [...indexed, ...untracked]) {
  reportWallets(`${shown(file)} (file name)`, file);
  reportNames(`${shown(file)} (file name)`, file);

  const stagedContent = staged.get(file);
  if (stagedContent) checkContent(file, ' (staged)', stagedContent);

  const path = join(root, file);
  if (!existsSync(path)) continue;
  const onDisk = readFileSync(path);
  if (!stagedContent || !onDisk.equals(stagedContent)) checkContent(file, '', onDisk);
}

if (problems.size > 0) {
  console.error(`guard: ${problems.size} problem(s)\n${[...problems].join('\n')}`);
  process.exit(1);
}

console.log(`guard: ${indexed.length + untracked.length} files clean.`);
