// Siteverify tokens last five minutes and are single-use. Scanner resolves inputs and verifies
// before running at most 10 wallets sequentially. runChecks races concurrent checks against a
// 10-second deadline per wallet: at most 100 seconds, including reads, retries and prices.
// Allow 20 seconds for pass delivery (5-second client timeout), in-flight proxy calls (5 seconds)
// and scheduling. Verification interaction happens before minting and needs no pass time.
export const PASS_SECONDS = 120;
export const SCAN_ACTION = 'scan';
export const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export function signingConfigured(secret: string | undefined): secret is string {
  return Boolean(secret && secret.length >= 32 && !/TO_SET|PLACEHOLDER|REPLACE_ME/.test(secret));
}

function key(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function mintPass(secret: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + PASS_SECONDS;
  const payload = `v1.${expiresAt}.${hex(crypto.getRandomValues(new Uint8Array(16)))}`;
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload));
  return { pass: `${payload}.${hex(signature)}`, expiresAt };
}

export async function validPass(pass: string | undefined, secret: string, now = Date.now()) {
  if (!pass || !/^v1\.[0-9]{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(pass)) return false;
  const parts = pass.split('.');
  const expiresAt = Number(parts[1]);
  const seconds = Math.floor(now / 1000);
  if (expiresAt <= seconds || expiresAt > seconds + PASS_SECONDS) return false;
  const signature = Uint8Array.from(parts[3]!.match(/../g)!, (byte) => parseInt(byte, 16));
  return crypto.subtle.verify(
    'HMAC',
    await key(secret),
    signature,
    encoder.encode(parts.slice(0, 3).join('.')),
  );
}
