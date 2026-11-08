import type { ReportLogo } from './catalog';

export type LogoEntry =
  | {
      kind: 'official';
      protocol: string;
      file: ReportLogo['file'];
      backdrop?: 'ink';
      sourcePage: string;
      fileUrl: string;
      archiveMember?: string;
      fetchedOn: string;
      terms: string;
    }
  | {
      kind: 'missing';
      protocol: string;
      reason: string;
      sourcePage: string;
      checkedOn: string;
      fileUrl?: string;
      fetchedOn?: string;
      terms?: string;
      termsUrl?: string;
    };

/** Build-time provenance only. The browser receives just the local file and backdrop. */
export const protocolLogos = {
  liquity: {
    kind: 'official',
    protocol: 'Liquity V1',
    file: '/logos/liquity.png',
    sourcePage: 'https://www.liquity.org/frontend',
    fileUrl:
      'https://cdn.prod.website-files.com/5fd883457ba5da4c3822b02c/66c874b93b8ab1576362a6c6_fav-icon.png',
    fetchedOn: '2026-11-02',
    terms:
      '32 px icon declared by the official V1 frontend list. Re-encoded as PNG without metadata at its original size. No usage terms are stated on that page.',
  },
  lido: {
    kind: 'official',
    protocol: 'Lido',
    file: '/logos/lido.png',
    sourcePage: 'https://stake.lido.fi/withdrawals/claim',
    fileUrl: 'https://stake.lido.fi/favicon-32x32.png',
    fetchedOn: '2026-11-02',
    terms:
      '32 px icon declared by the official withdrawal app. Re-encoded as PNG without metadata at its original size. No brand usage terms are stated on that page.',
  },
  ribbon: {
    kind: 'missing',
    protocol: 'Ribbon Theta V2',
    sourcePage: 'https://www.ribbon.finance/',
    checkedOn: '2026-11-02',
    reason:
      'The official site returned HTTP 503. The accessible legacy documentation establishes the contracts and recovery instructions, but no current logo asset with reviewed official provenance was selected.',
  },
  immutable: {
    kind: 'official',
    protocol: 'Immutable X',
    file: '/logos/immutable.png',
    sourcePage: 'https://www.immutable.com/',
    fileUrl: 'https://www.immutable.com/icon-dark.png',
    fetchedOn: '2026-11-02',
    terms:
      '180 px dark-mode icon declared by the official site. Re-encoded as PNG without metadata at its original size. No brand usage terms are stated on that page.',
  },
  jupiter: {
    kind: 'official',
    protocol: 'Jupiter Lock',
    file: '/logos/jupiter.png',
    sourcePage: 'https://lock.jup.ag/',
    fileUrl: 'https://lock.jup.ag/icons/logo.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Official Lock app icon declared by its home page. Rasterized at the original 65 by 64 size without metadata; artwork and colors are unchanged. No usage terms are stated on that page.',
  },
  marginfi: {
    kind: 'official',
    protocol: 'marginfi (Project 0)',
    file: '/logos/marginfi.svg',
    sourcePage:
      'https://github.com/mrgnlabs/mrgn-ts/blob/adcfdae468b784ed264976d4fe44722fb0b60903/apps/marginfi-v2-docs/src/images/logos/mrgn-logo.svg',
    fileUrl:
      'https://raw.githubusercontent.com/mrgnlabs/mrgn-ts/adcfdae468b784ed264976d4fe44722fb0b60903/apps/marginfi-v2-docs/src/images/logos/mrgn-logo.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Legacy marginfi mark from the official mrgnlabs repository, now deprecated. The docs Logo component pairs the same mark with the marginfi name. Artwork, colors and viewBox are unchanged. The current https://app.marginfi.com site presents Project 0 and directs active positions there; this report deliberately uses the marginfi identity. The repository README states Apache 2.0 for software, with no separate brand usage terms.',
  },
  kamino: {
    kind: 'official',
    protocol: 'Kamino',
    file: '/logos/kamino.png',
    sourcePage: 'https://app.kamino.finance',
    fileUrl: 'https://app.kamino.finance/favicon-32x32.png',
    fetchedOn: '2026-11-02',
    terms:
      '32 px icon declared by the official app, re-encoded as PNG without metadata, at its original size. No usage terms are stated on that page.',
  },
  meteora: {
    kind: 'official',
    protocol: 'Meteora',
    file: '/logos/meteora.svg',
    sourcePage: 'https://www.meteora.ag',
    fileUrl: 'https://www.meteora.ag/icons/v2.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Passive SVG icon declared by the official home page. No usage terms are stated on that page; artwork is unchanged.',
  },
  instadapp: {
    kind: 'official',
    protocol: 'Instadapp',
    file: '/logos/instadapp.svg',
    sourcePage: 'https://github.com/Instadapp/brand',
    fileUrl: 'https://raw.githubusercontent.com/Instadapp/brand/master/logo_sign.svg',
    fetchedOn: '2026-11-02',
    terms:
      'The official brand repository provides the sign. No usage terms are stated in its README.',
  },
  defisaver: {
    kind: 'official',
    protocol: 'DeFi Saver (DSProxy recovery route)',
    file: '/logos/defisaver.svg',
    backdrop: 'ink',
    sourcePage: 'https://app.defisaver.com',
    fileUrl: 'https://app.defisaver.com/assets/icons/safari-pinned-tab.svg?v=JyBppYLnYd',
    fetchedOn: '2026-11-02',
    terms: 'Official app mask icon. No brand usage terms are stated on the source page.',
  },
  giveth: {
    kind: 'official',
    protocol: 'Giveth',
    file: '/logos/giveth.svg',
    backdrop: 'ink',
    sourcePage: 'https://github.com/Giveth/giveth-design-assets',
    fileUrl:
      'https://raw.githubusercontent.com/Giveth/giveth-design-assets/9fc25bfcd4a04cae53ceaecb8f96e5db738ff8a5/02-logos/Giveth%20Logo/02-LOGO%20MARK%20VERSIONS/SVG/Logo%20Mark%2001%20Blue.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Official design repository, current logo mark folder. No usage terms are stated in its README.',
  },
  aave: {
    kind: 'official',
    protocol: 'Aave',
    file: '/logos/aave.svg',
    sourcePage: 'https://aave.com/brand',
    fileUrl: 'https://aave.com/aave-brand-assets.zip',
    archiveMember: 'Aave Brand Assets/Aave Logo/Logomark Light.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Usage guidelines and permission for websites without misrepresentation. "The Aave logo should be used in its original form without any modifications."',
  },
  hyperliquid: {
    kind: 'official',
    protocol: 'Hyperliquid',
    file: '/logos/hyperliquid.svg',
    sourcePage: 'https://app.hyperliquid.xyz',
    fileUrl: 'https://app.hyperliquid.xyz/images/blob.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Symbol referenced by the official app JavaScript. No brand usage terms are stated on the source page. The official docs also offer a brand kit.',
  },
  merkl: {
    kind: 'official',
    protocol: 'Merkl',
    file: '/logos/merkl.svg',
    sourcePage: 'https://merkl.xyz/brand',
    fileUrl: 'https://merkl.xyz/brand/logo-dark.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Brand guidelines specify a 24 px minimum for the logo and suitable contrast. "Assets come with built-in spacing."',
  },
  safe: {
    kind: 'official',
    protocol: 'Safe',
    file: '/logos/safe.svg',
    backdrop: 'ink',
    sourcePage: 'https://safe.global',
    fileUrl: 'https://safe.global/images/common/safe-icon.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Official site identifies this symbol as Safe. No brand usage terms are stated on the source page.',
  },
  compound: {
    kind: 'official',
    protocol: 'Compound',
    file: '/logos/compound.svg',
    sourcePage: 'https://github.com/compound-finance/compound-components',
    fileUrl:
      'https://raw.githubusercontent.com/compound-finance/compound-components/ee3bb04971f39bef8695cf013ff2a2344b6b9091/src/public/assets/compound-mark.svg',
    fetchedOn: '2026-11-02',
    terms: 'Official component repository. No brand usage terms are stated on the source page.',
  },
  cream: {
    kind: 'official',
    protocol: 'Cream Finance',
    file: '/logos/cream.svg',
    sourcePage: 'https://cream.finance',
    fileUrl: 'https://cream.finance/_nuxt/img/b370b30.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Full logo used by the official home page. No separate SVG symbol was located, so the viewBox is cropped to the circular mark (paths unchanged). No brand usage terms are stated there.',
  },
  koi: {
    kind: 'official',
    protocol: 'Koi (formerly Mute)',
    file: '/logos/koi.svg',
    sourcePage: 'https://www.koi.finance',
    fileUrl: 'https://www.koi.finance/assets/logo/mark-small.svg',
    fetchedOn: '2026-11-02',
    terms: 'Official site logomark. No brand usage terms are stated on the source page.',
  },
  uniswap: {
    kind: 'missing',
    protocol: 'Uniswap',
    sourcePage: 'https://github.com/Uniswap/brand-assets',
    fileUrl:
      'https://raw.githubusercontent.com/Uniswap/brand-assets/1d829912a8b1c154b700984f88baa83142ee1a1b/Uniswap%20Brand%20Assets/Uniswap_icon_pink.svg',
    fetchedOn: '2026-11-02',
    checkedOn: '2026-11-02',
    termsUrl:
      'https://support.uniswap.org/hc/en-us/articles/30934762216973-Uniswap-Labs-Trademark-Guidelines',
    terms:
      'The brand repository links the trademark policy: "Do not use the Uniswap logos without prior written permission." Direct GET returned HTTP 403; the official policy was readable through the web tool.',
    reason:
      'An official SVG was located, but the linked trademark policy requires prior written permission for logos. No permission is documented for this project, so the report keeps its text-only layout.',
  },
  zksync: {
    kind: 'official',
    protocol: 'ZKsync',
    file: '/logos/zksync.svg',
    sourcePage: 'https://www.zksync.io/brand',
    fileUrl: 'https://www.zksync.io/brand/zksync-logo/zksync-logomark-light-transparent.svg',
    fetchedOn: '2026-11-02',
    terms:
      'The brand page provides light and dark variants. "Use it consistently to help people instantly identify ZKsync across all platforms."',
  },
  kittypunch: {
    kind: 'official',
    protocol: 'KittyPunch',
    file: '/logos/kittypunch.png',
    sourcePage: 'https://kittypunch.xyz',
    fileUrl: 'https://kittypunch.xyz/apple-touch-icon.png',
    fetchedOn: '2026-11-02',
    terms:
      'The site icon declared by the official home page (the K mark), resized from 180 to 48 px for a 24 px slot. No SVG or brand usage terms were located.',
  },
  solana: {
    kind: 'official',
    protocol: 'Solana',
    file: '/logos/solana.svg',
    sourcePage: 'https://solana.com/branding',
    fileUrl:
      'https://raw.githubusercontent.com/solana-foundation/solana-com/b83505d379f083d55560e696765d7d84429e18fa/apps/web/public/src/img/branding/solanaLogoMark.svg',
    fetchedOn: '2026-11-02',
    terms:
      'Brand guidelines apply; preserve the artwork. "Do not imply Foundation sponsorship, endorsement, or affiliation where none exists." The site download returned HTTP 429, so the file comes from its official source repository.',
  },
} as const satisfies Record<string, LogoEntry>;

/** One shared identity per protocol, including legacy checks. New checks must be reviewed. */
export const protocolByCheck = {
  'liquity-surplus': 'liquity',
  'lido-withdrawals': 'lido',
  'ribbon-v2': 'ribbon',
  'immutable-withdrawals': 'immutable',
  'instadapp-dsa': 'instadapp',
  dsproxy: 'defisaver',
  'giv-tokendistro': 'giveth',
  'aave-v2-rewards': 'aave',
  hyperliquid: 'hyperliquid',
  merkl: 'merkl',
  'safe-owner': 'safe',
  'safe-locking': 'safe',
  'compound-v2': 'compound',
  cream: 'cream',
  'koi-fees': 'koi',
  'koi-lp': 'koi',
  'koi-amplifier': 'koi',
  'koi-farm': 'koi',
  'uni-2020': 'uniswap',
  'zksync-lite': 'zksync',
  'kitty-loot-farm': 'kittypunch',
  'solana-stake': 'solana',
  'solana-rent': 'solana',
  'meteora-dlmm': 'meteora',
  'kamino-liquidity': 'kamino',
  marginfi: 'marginfi',
  'jupiter-lock': 'jupiter',
} as const satisfies Record<string, keyof typeof protocolLogos>;

export function reportLogoForCheck(checkId: string): ReportLogo | undefined {
  if (!Object.hasOwn(protocolByCheck, checkId)) return undefined;
  const protocol = protocolByCheck[checkId as keyof typeof protocolByCheck];
  if (!protocol) return undefined;
  const entry: LogoEntry = protocolLogos[protocol];
  return entry.kind === 'official'
    ? { file: entry.file, ...('backdrop' in entry ? { backdrop: entry.backdrop } : {}) }
    : undefined;
}
