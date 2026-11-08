import { describe, expect, it, vi } from 'vitest';
import { checks } from '@deficheckup/catalog';

// Markdown is compiled by Astro in builds. This unit test supplies only the date metadata.
vi.mock('./guides', () => ({
  guideMetadata: new Proxy({}, { get: () => ({ verifiedOn: '2026-11-01' }) }),
  guidePath: (id: string) => `/protocols/${id}`,
}));
import { GET } from '../pages/sitemap.xml';

describe('sitemap routes', () => {
  it('includes closing-soon and support once alongside every canonical and guide date', async () => {
    const response = await GET({ site: new URL('https://deficheckup.com') } as Parameters<
      typeof GET
    >[0]);
    const xml = await response.text();
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(xml.match(/<loc>https:\/\/deficheckup.com\/closing-soon<\/loc>/g)).toHaveLength(1);
    expect(xml.match(/<loc>https:\/\/deficheckup.com\/support<\/loc>/g)).toHaveLength(1);
    expect(xml.match(/<loc>/g)).toHaveLength(checks.length + 5);
    for (const check of checks)
      expect(xml).toContain(
        `<loc>https://deficheckup.com/protocols/${check.id}</loc><lastmod>2026-11-01</lastmod>`,
      );
  });
});
