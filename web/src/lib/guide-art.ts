// Build-time manifest shared by guide pages and social exports. Short guides have no artwork.
export const guideArt = {
  'zksync-lite': {
    file: 'zksync-lite.webp',
    alt: 'A row of shut boxes; one still holds three coins, and an arrow points to a larger box below, showing a route out for leftover funds.',
  },
  'uni-2020': {
    file: 'uni-2020.webp',
    alt: 'An open box still holds a pink coin between two closed boxes, suggesting an old allocation that may remain unclaimed.',
  },
  'compound-v2': {
    file: 'compound-v2.webp',
    alt: 'A balance scale weighs colored coins against empty coin outlines, showing why deposits must be considered alongside debt.',
  },
  cream: {
    file: 'cream.webp',
    alt: 'Three coins sit inside a locked vault, showing funds that can be identified but cannot currently be withdrawn.',
  },
  'aave-v2-rewards': {
    file: 'aave-v2-rewards.webp',
    alt: 'A jar holds many blue coins beneath another suspended coin, representing rewards that have accumulated over time.',
  },
  'instadapp-dsa': {
    file: 'instadapp-dsa.webp',
    alt: 'A large account box contains a smaller box with three colored coins tucked into its corner, showing funds left inside a smart account.',
  },
  dsproxy: {
    file: 'dsproxy.webp',
    alt: 'An empty box is linked to a second box holding two coins and an empty outline, showing balances kept in a separate smart wallet.',
  },
  hyperliquid: {
    file: 'hyperliquid.webp',
    alt: 'Four account boxes stand in a row; one holds four green coins, showing how a balance can remain in one of several account types.',
  },
  'solana-rent': {
    file: 'solana-rent.webp',
    alt: 'Small account boxes each hold a tiny coin, with an arrow pointing to one box collecting the coins, illustrating refundable account rent.',
  },
  'koi-lp': {
    file: 'koi-mute.webp',
    alt: 'Colored coins sit inside a large circular pool, representing liquidity that may remain in an old pool position.',
  },
} as const satisfies Record<string, { file: string; alt: string }>;

export function artForGuide(id: string) {
  return Object.hasOwn(guideArt, id) ? guideArt[id as keyof typeof guideArt] : undefined;
}

// Split only Astro-compiled, repository-owned Markdown. Keep the answer before the image.
export function splitGuideIntro(html: string) {
  const match = html.match(/^(\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*<p>[\s\S]*?<\/p>)([\s\S]*)$/);
  if (!match) throw new Error('Illustrated guides must start with an H1 and an answer paragraph.');
  return { intro: match[1]!, rest: match[2]! };
}
