export interface GuideMetadata {
  title: string;
  description: string;
  targetQuery: string;
  intent: 'Informational';
  verifiedOn: string;
  featured: boolean;
  secondaryQueries?: string[];
}

// Build-time only. Metadata and content come from the same catalog Markdown file.
const files = import.meta.glob<GuideMetadata>('../../../catalog/*/guide.en.md', {
  eager: true,
  import: 'frontmatter',
});
export const guideMetadata = Object.fromEntries(
  Object.entries(files)
    .filter(([path]) => !path.includes('/example/'))
    .map(([path, metadata]) => [path.split('/').at(-2)!, metadata]),
);

export function guidePath(id: string) {
  return `/protocols/${id}`;
}

export function guideStructuredData(id: string, heading: string, site: URL) {
  const guide = guideMetadata[id]!;
  const url = new URL(guidePath(id), site).href;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: heading,
        description: guide.description,
        dateModified: guide.verifiedOn,
        inLanguage: 'en',
        mainEntityOfPage: url,
        image: [new URL(`/social/${id}.png`, site).href],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.href },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Protocols',
            item: new URL('/protocols', site).href,
          },
          { '@type': 'ListItem', position: 3, name: heading, item: url },
        ],
      },
    ],
  };
}

// Escape script terminators without changing the parsed JSON value.
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
