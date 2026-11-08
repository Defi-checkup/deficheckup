import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isSolanaAddress } from '@deficheckup/engine';
import { checks } from './index';

const ids = new Set(checks.map(({ id }) => id));
const guides = checks.map((check) => ({
  check,
  text: readFileSync(new URL(`./${check.id}/guide.en.md`, import.meta.url), 'utf8'),
}));

// The editorial scalar fields stay on one line. YAML quote style may change during formatting.
function field(text: string, name: string) {
  const value = text.split('---')[1]?.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1];
  if (!value) throw new Error(`Missing guide field: ${name}`);
  return value.startsWith("'")
    ? value.slice(1, -1).replace(/''/g, "'")
    : (JSON.parse(value) as string);
}

describe('guide editorial requirements', () => {
  it.each(guides)(
    '$check.id has counted metadata, a FAQ and a genuine verification date',
    ({ check, text }) => {
      const title = field(text, 'title');
      const description = field(text, 'description');
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThanOrEqual(150);
      expect(description.length).toBeLessThanOrEqual(160);
      expect(text.match(/^# /gm)).toHaveLength(1);
      expect(field(text, 'verifiedOn')).toBe(check.verifiedOn);
      const verified = text.split('## Verified on\n\n')[1]?.slice(0, 10);
      expect(verified).toBe(check.verifiedOn);
      expect(new Date(`${verified}T00:00:00Z`).toISOString().slice(0, 10)).toBe(verified);
      const faq = text.split('## FAQ\n\n')[1]?.split('\n## ')[0];
      expect(faq).toBeTruthy();
      const questions = faq!.split(/^### /m).slice(1);
      expect(questions.length).toBeGreaterThanOrEqual(3);
      expect(questions.length).toBeLessThanOrEqual(5);
      for (const question of questions) {
        expect(question.split('\n\n').slice(1).join(' ').trim().length).toBeGreaterThan(40);
      }
      expect(text).toMatch(/\]\(\/\)/);
    },
  );

  it('keeps titles and descriptions unique across all active guides', () => {
    for (const name of ['title', 'description']) {
      expect(new Set(guides.map(({ text }) => field(text, name))).size).toBe(guides.length);
    }
  });

  it.each(guides)(
    '$check.id preserves complete addresses and working internal guide destinations',
    ({ text }) => {
      expect(text).not.toMatch(/\b0x[\da-f]*(?:\.{2,}|\u2026)[\da-f]*/i);
      expect(text).not.toMatch(/`[1-9A-HJ-NP-Za-km-z]{8,}(?:\.{2,}|\u2026)/);
      for (const match of text.matchAll(/`([1-9A-HJ-NP-Za-km-z]{32,44})`/g)) {
        expect(isSolanaAddress(match[1]!), match[1]).toBe(true);
      }
      for (const hex of text.match(/\b0x[\da-f]+/gi) ?? []) {
        // Contract addresses, transaction hashes, or explicitly documented function selectors.
        expect([8, 40, 64], hex).toContain(hex.length - 2);
      }
      for (const match of text.matchAll(/\]\(\/protocols\/([^/)]+)\/?(?:#[^)]*)?\)/g)) {
        expect(ids.has(match[1]!)).toBe(true);
      }
    },
  );

  it('has ten full search-intent guides with five answered questions each', () => {
    const featured = guides.filter(({ text }) => /^featured: true$/m.test(text));
    expect(featured).toHaveLength(10);
    for (const { text } of featured) {
      expect(field(text, 'targetQuery').length).toBeGreaterThan(5);
      expect(text.split('## FAQ\n\n')[1]!.match(/^### /gm)).toHaveLength(5);
      expect(text.split('---').slice(2).join(' ').split(/\s+/).length).toBeGreaterThan(500);
      expect(text).toMatch(/^## What (?:happened|it costs)/m);
      expect(text).toMatch(/^## Who /m);
      expect(text).toMatch(/^## How to get it out/m);
      expect(text).toMatch(/^## What it costs/m);
      expect(text).toMatch(/^## Deadline/m);
    }
  });

  it('cross-links the combined Koi guide, smart wallet guides and both Solana guides', () => {
    const links = (id: string) => guides.find(({ check }) => check.id === id)!.text;
    for (const id of ['koi-fees', 'koi-amplifier', 'koi-farm']) {
      expect(links('koi-lp')).toContain(`/protocols/${id}/`);
      expect(links(id)).toContain('/protocols/koi-lp/');
    }
    for (const id of ['compound-v2', 'dsproxy', 'instadapp-dsa']) {
      for (const other of ['compound-v2', 'dsproxy', 'instadapp-dsa'].filter(
        (item) => item !== id,
      )) {
        expect(links(id)).toContain(`/protocols/${other}/`);
      }
    }
    expect(links('solana-rent')).toContain('/protocols/solana-stake/');
    expect(links('solana-stake')).toContain('/protocols/solana-rent/');
  });
});
