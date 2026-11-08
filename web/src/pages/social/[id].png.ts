import type { APIRoute } from 'astro';
import { guideMetadata } from '../../lib/guides';
import { socialImage } from '../../lib/social-image';

export function getStaticPaths() {
  return [
    {
      params: { id: 'home' },
      props: { title: 'Find overlooked balances across your wallets', home: true },
    },
    ...Object.entries(guideMetadata).map(([id, guide]) => ({
      params: { id },
      props: { title: guide.title.replace(' | DeFi Checkup', ''), home: false },
    })),
  ];
}

export const GET: APIRoute = async ({ props, params }) => {
  const png = await socialImage(props.title as string, props.home as boolean, params.id);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
