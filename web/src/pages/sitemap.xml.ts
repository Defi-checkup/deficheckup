import type { APIRoute } from 'astro';
import { checks } from '@deficheckup/catalog';
import { guideMetadata, guidePath } from '../lib/guides';

export const GET: APIRoute = ({ site }) => {
  const pages: { path: string; lastmod?: string }[] = [
    { path: '/' },
    { path: '/protocols' },
    { path: '/closing-soon' },
    { path: '/privacy' },
    { path: '/support' },
    ...checks.map(({ id }) => ({ path: guidePath(id), lastmod: guideMetadata[id]!.verifiedOn })),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages
      .map(
        ({ path, lastmod }) =>
          `<url><loc>${new URL(path, site).href}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
      )
      .join('')}</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
