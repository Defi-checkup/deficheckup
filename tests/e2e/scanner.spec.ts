import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, Route } from '@playwright/test';
import stakeRecorded from '../../catalog/solana-stake/recorded.json' with { type: 'json' };
import rentRecorded from '../../catalog/solana-rent/recorded.json' with { type: 'json' };
import { artForGuide } from '../../web/src/lib/guide-art';
import { safeOwnerCheck } from '../../catalog/safe-owner/check';
import { ETHEREUM_TOKENS } from '../../catalog/shared/tokens';
import { MAX_PASS_SECONDS } from '../../web/src/lib/proxy-session';
import { SUPPORT } from '../../web/src/lib/support';

const ADDRESS = '0x000000000000000000000000000000000000dEaD';
const OTHER = '0x6e8c0dcd579d0b38e228f5c5ea7d2fb80d336891';
// Existing public on-chain addresses only. All responses are synthetic and intercepted.
const PUBLIC_ADDRESSES = [ADDRESS, OTHER, ...ETHEREUM_TOKENS.map((token) => token.address)].slice(
  0,
  10,
);

// Model Cloudflare's official always-pass key and dummy-token behavior entirely offline.
// The proxy exchange is stubbed too: no test ever contacts Siteverify.
async function stubVerification(route: Route, blocked = false, interactive = false) {
  const url = new URL(route.request().url());
  if (url.hostname === 'challenges.cloudflare.com') {
    if (interactive && url.pathname === '/turnstile/offline-widget') {
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><title>Offline verification</title></head>
          <body><div><label><input type="checkbox">Verify you are human</label></div>
          <script>document.querySelector('input').addEventListener('change', () => {
            parent.postMessage('offline-turnstile-complete', 'http://127.0.0.1:4321');
          });</script></body></html>`,
      });
      return true;
    }
    expect(url.pathname).toBe('/turnstile/v0/api.js');
    expect(url.searchParams.get('render')).toBe('explicit');
    if (blocked) await route.abort();
    else
      await route.fulfill({
        contentType: 'text/javascript',
        body: `
      (() => {
        let options;
        let widget;
        let onMessage;
        window.turnstile = {
          render(container, value) {
            if (value.sitekey !== '1x00000000000000000000AA') throw Error('Use the official test key');
            options = value;
            if (${interactive}) {
              widget = document.createElement('iframe');
              widget.title = 'Offline Cloudflare verification';
              widget.width = '100%';
              widget.height = '65';
              widget.setAttribute('frameborder', '0');
              widget.src = 'https://challenges.cloudflare.com/turnstile/offline-widget';
              widget.hidden = true;
              container.append(widget);
            }
            return 'offline-widget';
          },
          execute() {
            if (!${interactive}) {
              queueMicrotask(() => options.callback('XXXX.DUMMY.TOKEN.XXXX'));
              return;
            }
            options['before-interactive-callback']();
            widget.hidden = false;
            onMessage = (event) => {
              if (event.origin !== 'https://challenges.cloudflare.com' ||
                  event.data !== 'offline-turnstile-complete') return;
              widget.hidden = true;
              options['after-interactive-callback']();
              window.addEventListener('offline-turnstile-pass', () => {
                options.callback('XXXX.DUMMY.TOKEN.XXXX');
              }, { once: true });
            };
            window.addEventListener('message', onMessage);
          },
          remove() {
            widget?.remove();
            window.removeEventListener('message', onMessage);
            options = undefined;
          }
        };
      })();`,
      });
    return true;
  }
  if (url.hostname === 'proxy.deficheckup.test' && url.pathname === '/scan-pass') {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-scan-pass',
      'Access-Control-Allow-Methods': 'POST',
    };
    if (route.request().method() === 'OPTIONS') await route.fulfill({ status: 204, headers });
    else {
      expect(route.request().postDataJSON()).toEqual({ token: 'XXXX.DUMMY.TOKEN.XXXX' });
      const expiresAt = Math.floor(Date.now() / 1000) + MAX_PASS_SECONDS;
      await route.fulfill({
        headers,
        json: {
          expiresAt,
          pass: `v1.${expiresAt}.${'0'.repeat(32)}.${'0'.repeat(64)}`,
        },
      });
    }
    return true;
  }
  if (url.hostname === 'proxy.deficheckup.test' && route.request().method() === 'POST') {
    expect(route.request().headers()['x-scan-pass']).toMatch(
      /^v1\.[0-9]{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/,
    );
  }
  return false;
}

test('scans Solana with synthetic stake and rent responses, correct coverage and no EVM calls', async ({
  page,
}, testInfo) => {
  // Public mainnet fixture address. Every response is intercepted; no provider sees this scan.
  const address = stakeRecorded.address;
  const stake = structuredClone(stakeRecorded.accounts);
  const bytes = Buffer.from(stake.value[0]!.account.data[0]!, 'base64');
  bytes.writeUInt32LE(1, 0); // synthetic initialized, fully withdrawable stake account
  stake.value[0]!.account.data[0] = bytes.toString('base64');
  const tokens = structuredClone(rentRecorded.tokens);
  const tokens2022 = structuredClone(rentRecorded.tokens2022);
  for (const entry of [...tokens.value, ...tokens2022.value])
    entry.account.data.parsed.info.owner = address;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const methods: string[] = [];
  const unexpected: string[] = [];
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/.test(message.text())) violations.push(message.text());
  });
  await page.route('**/*', async (route) => {
    if (await stubVerification(route)) return;
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4321') {
      await route.continue();
      return;
    }
    await gate;
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-scan-pass',
      'Access-Control-Allow-Methods': 'POST, GET',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.hostname === 'coins.llama.fi') {
      expect(url.pathname).toContain('coingecko:solana');
      await route.fulfill({ json: { coins: { 'coingecko:solana': { price: 100 } } }, headers });
      return;
    }
    if (url.hostname === 'proxy.deficheckup.test' && url.pathname === '/solana') {
      const body = route.request().postDataJSON() as { method: string; params: unknown[] };
      methods.push(body.method);
      const result =
        body.method === 'getProgramAccounts'
          ? body.params[0] === 'Stake11111111111111111111111111111111111111'
            ? stake
            : { context: { slot: stake.context.slot }, value: [] }
          : body.method === 'getAccountInfo'
            ? String(body.params[0]).includes('History')
              ? stakeRecorded.history
              : stakeRecorded.clock
            : (body.params[1] as { programId: string }).programId.startsWith('Tokenkeg')
              ? tokens
              : tokens2022;
      await route.fulfill({ json: { result }, headers });
      return;
    }
    unexpected.push(url.origin);
    await route.abort();
  });
  await page.goto('/');
  await expect(page.locator('main a[href="/support"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(address);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.locator('.progress-line')).toContainText('of 6 checks complete');
  await expect(page.locator('main a[href="/support"]')).toHaveCount(0);
  await expect(page.locator('.network-board').first().locator('.network-tile')).toHaveCount(1);
  release();
  await expect(page.getByRole('heading', { name: 'Here is what turned up' })).toBeVisible();
  await expect(page.locator('main a[href="/support"]')).toHaveText('support it');
  const report = page.locator('.wallet-report');
  for (const summary of await report.locator('.finding-disclosure summary').all())
    await summary.click();
  await expect(report).toContainText('SOL rent in 1 empty token account');
  await expect(report).toContainText('Holding account');
  await expect(report).toContainText(stake.value[0]!.pubkey);
  await expect(report).toContainText('Deactivate it first');
  await expect(report).toContainText("owner's signature");
  await expect(page.locator('.report-summary')).toContainText('≈ $354.60');
  expect(methods.filter((method) => method === 'getTokenAccountsByOwner')).toHaveLength(2);
  expect(methods.filter((method) => method === 'getProgramAccounts')).toHaveLength(5);
  expect(unexpected).toEqual([]);
  expect(violations).toEqual([]);
  await expect(page.locator('.network-board .network-tile')).toHaveCount(1);
  await expect(page.locator('.network-board .network-tile')).toContainText('Solana');
  await addressSafety(report);
  await accessible(page);
  await noOverflow(page);
  await capture(page, testInfo.outputPath('solana-report.png'));
  await page.goto('/protocols');
  await expect(page.getByRole('link', { name: 'Withdraw Inactive Solana Stake' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Reclaim Solana Rent From Empty Accounts' }),
  ).toBeVisible();
});

async function addressSafety(wallet: Locator) {
  await expect(wallet.getByText('Avoid address poisoning:', { exact: false })).toHaveCount(1);
  expect(
    await wallet.evaluate((element) => {
      const warning = element.querySelector(':scope > .notice');
      const official = element.querySelector('a[target="_blank"]');
      return Boolean(
        warning &&
        official &&
        warning.compareDocumentPosition(official) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
}

test('keeps token findings visible during a price outage and recovers on Scan again', async ({
  page,
}) => {
  let pricesDown = true;
  let priceRequests = 0;
  const tokens = structuredClone(rentRecorded.tokens);
  const tokens2022 = structuredClone(rentRecorded.tokens2022);
  for (const entry of [...tokens.value, ...tokens2022.value])
    entry.account.data.parsed.info.owner = stakeRecorded.address;
  const unexpected: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.route('**/*', async (route) => {
    if (await stubVerification(route)) return;
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4321') {
      await route.continue();
      return;
    }
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-scan-pass',
      'Access-Control-Allow-Methods': 'POST, GET',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.hostname === 'coins.llama.fi') {
      priceRequests++;
      expect(url.pathname).toContain('coingecko:solana');
      await route.fulfill(
        pricesDown
          ? { status: 503, body: 'temporarily unavailable', headers }
          : { json: { coins: { 'coingecko:solana': { price: 100 } } }, headers },
      );
      return;
    }
    if (url.hostname === 'proxy.deficheckup.test' && url.pathname === '/solana') {
      const body = route.request().postDataJSON() as { method: string; params: unknown[] };
      const result =
        body.method === 'getProgramAccounts'
          ? { context: { slot: stakeRecorded.accounts.context.slot }, value: [] }
          : body.method === 'getAccountInfo'
            ? String(body.params[0]).includes('History')
              ? stakeRecorded.history
              : stakeRecorded.clock
            : (body.params[1] as { programId: string }).programId.startsWith('Tokenkeg')
              ? tokens
              : tokens2022;
      await route.fulfill({ json: { result }, headers });
      return;
    }
    unexpected.push(url.origin);
    await route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(stakeRecorded.address);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.locator('#report-title')).toBeFocused();
  const summary = page.locator('.report-summary');
  await expect(summary).toContainText('Prices unavailable right now for 1 finding.');
  await expect(page.locator('#report-completion')).toContainText('0.00148844 SOL');
  await expect(summary).not.toContainText('≈ $0.00');
  const card = page.locator('.wallet-report .finding');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.finding-value .value')).toHaveText('0.00148844 SOL');
  await expect(card.locator('.finding-value .mono')).toHaveText('price unavailable');
  await expect(page.getByRole('button', { name: /Show .* unpriced/ })).toHaveCount(0);
  expect(priceRequests).toBe(2);
  await accessible(page);
  await noOverflow(page);
  pricesDown = false;
  await page.getByRole('button', { name: 'Scan again', exact: true }).click();
  await expect(page.locator('#report-title')).toBeFocused();
  await expect(summary).not.toContainText('Prices unavailable');
  await expect(page.locator('#report-completion')).toContainText('≈ $0.14');
  await expect(card.locator('.finding-value .value')).toHaveText('0.00148844 SOL');
  await expect(card.locator('.finding-value .mono')).toHaveText('≈ $0.14');
  expect(priceRequests).toBe(3);
  expect(unexpected).toEqual([]);
  expect(failures).toEqual([]);
  await card.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(card.getByText('SOL rent in 1 empty token account', { exact: false })).toBeVisible();
  await accessible(page);
  await noOverflow(page);
});

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(result.violations).toEqual([]);
  const headings = await page
    .locator('main :is(h1,h2,h3,h4,h5,h6)')
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => Number(element.tagName[1])),
    );
  expect(headings[0]).toBe(1);
  expect(headings.every((level, index) => index === 0 || level <= headings[index - 1]! + 1)).toBe(
    true,
  );
}

async function controlTargets(page: Page) {
  const small = await page
    .locator(
      'button:enabled, summary, nav a, .wordmark, .links a, .stack > a, .card-grid h2 a, footer a',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 24 || rect.height < 24 ? [element.textContent] : [];
        }),
    );
  expect(small).toEqual([]);
}

async function mockProviders(
  page: Page,
  mode:
    | 'found'
    | 'empty'
    | 'error'
    | 'many'
    | 'unpriced'
    | 'safe-limited'
    | 'by-wallet'
    | 'turnstile-blocked'
    | 'turnstile-interactive' = 'found',
  heldWallet?: string,
) {
  let requests = 0;
  const walletOrder: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let releaseWallet: () => void = () => {};
  const walletGate = new Promise<void>((resolve) => {
    releaseWallet = resolve;
  });
  await page.route('**/*', async (route) => {
    if (
      await stubVerification(route, mode === 'turnstile-blocked', mode === 'turnstile-interactive')
    )
      return;
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4321') {
      await route.continue();
      return;
    }
    requests++;
    await gate;
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'content-type, x-scan-pass',
          'Access-Control-Allow-Methods': 'POST, GET',
        },
      });
      return;
    }
    // Every external request is intercepted. No wallet ever reaches a live provider.
    if (url.hostname === 'api.hyperliquid.xyz' && mode !== 'error') {
      const body = route.request().postDataJSON() as { type: string; user: string };
      if (body.type === 'clearinghouseState') walletOrder.push(body.user);
      if (heldWallet && body.user === heldWallet) await walletGate;
      const hasBalance =
        mode === 'found' ||
        mode === 'many' ||
        mode === 'turnstile-blocked' ||
        (mode === 'by-wallet' && body.user === ADDRESS);
      const responses: Record<string, unknown> = {
        clearinghouseState: { withdrawable: hasBalance ? '12.3456' : '0' },
        spotClearinghouseState: {
          balances:
            mode === 'many'
              ? [
                  ...Array.from({ length: 110 }, (_, i) => ({
                    coin: `UNPRICED${i}`,
                    token: 1000 + i,
                    total: '1',
                  })),
                  ...Array.from({ length: 44 }, (_, i) => ({
                    coin: `PRICED${i}`,
                    token: i + 1,
                    total: String(i + 1),
                  })),
                ]
              : hasBalance || mode === 'unpriced'
                ? [{ coin: 'UNKNOWN', token: 999, total: '0.000000000000000001' }]
                : [],
        },
        delegatorSummary: { delegated: '0', undelegated: '0', totalPendingWithdrawal: '0' },
        userVaultEquities: mode === 'many' ? [{ equity: '200' }, { equity: '1000' }] : [],
        spotMetaAndAssetCtxs:
          mode === 'many'
            ? [
                {
                  tokens: [],
                  universe: Array.from({ length: 44 }, (_, i) => ({
                    name: `MARKET${i}`,
                    tokens: [i + 1, 0],
                  })),
                },
                Array.from({ length: 44 }, (_, i) => ({
                  coin: `MARKET${i}`,
                  markPx: '1',
                  dayNtlVlm: '10000',
                })),
              ]
            : [{ tokens: [], universe: [] }, []],
      };
      await route.fulfill({
        json: responses[body.type],
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    } else if (
      url.hostname === 'proxy.deficheckup.test' &&
      url.pathname === '/safe' &&
      mode === 'safe-limited'
    ) {
      await route.fulfill({
        json: {
          lists: Object.fromEntries(
            safeOwnerCheck.networks.map((network) => [network, network === 'base' ? null : []]),
          ),
        },
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    } else if (url.hostname === 'api.merkl.xyz' && mode !== 'error' && mode !== 'safe-limited') {
      await route.fulfill({
        json:
          mode === 'many'
            ? [
                {
                  chain: { id: 1 },
                  rewards: [
                    {
                      amount: '1',
                      claimed: '0',
                      token: { symbol: 'MERKL', decimals: 0, price: 500 },
                    },
                    { amount: 'unreadable' },
                  ],
                },
              ]
            : [],
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    } else {
      await route.abort();
    }
  });
  return { count: () => requests, release, walletOrder, releaseWallet };
}

// Resolve once by name, then follow aria-controls so changing toggle text keeps the same locator.
async function foldButton(page: Page, name: string) {
  const id = await page.getByRole('button', { name, exact: true }).getAttribute('aria-controls');
  expect(id).toBeTruthy();
  return page.locator(`button[aria-controls="${id}"]`);
}

/**
 * The visible screen, kept as a reference image. Full-page captures of long reports fail in
 * headless Chromium (one of 7,967 px did on 2026-11-01), and the images assert nothing.
 */
async function capture(page: Page, path: string) {
  await page.screenshot({ path });
}

/** No horizontal scroll. On failure, names the elements that stick out. */
async function noOverflow(page: Page) {
  const wide = await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth
      ? []
      : [...document.querySelectorAll('body *')]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 5)
          .map(
            (el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.textContent?.slice(0, 60)}`,
          ),
  );
  expect(wide).toEqual([]);
}

// Hold the first frame so axe checks the lowest surface opacity, regardless of scan speed.
async function accessibleAtCardArrival(page: Page) {
  const cards = page.locator('.finding');
  expect(await cards.count()).toBeGreaterThan(0);
  await cards.evaluateAll((elements) => {
    for (const element of elements) {
      const card = element as HTMLElement;
      card.style.animation = 'none';
      void card.offsetHeight;
      card.style.removeProperty('animation');
      for (const animation of card.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    }
  });
  try {
    await expect(cards.first()).toHaveCSS('opacity', '1');
    expect(await cards.first().evaluate((card) => getComputedStyle(card).backgroundColor)).toMatch(
      /[,/]\s*0\.28\)$/,
    );
    for (const coin of await cards.locator('.coin').all()) {
      await expect(coin).toHaveCSS('opacity', '1');
    }
    await accessible(page);
  } finally {
    await cards.evaluateAll((elements) => {
      for (const card of elements) for (const animation of card.getAnimations()) animation.finish();
    });
  }
}

test('hero copy paints outside the island with JavaScript disabled', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    baseURL: testInfo.project.use.baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('Find overlooked balances across your wallets.');
    await expect(title).toBeVisible();
    await expect(page.locator('.hero .lede')).toBeVisible();
    await expect(page.locator('astro-island #home-title')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeDisabled();
  } finally {
    await context.close();
  }
});

test('static pages, local fonts and strict headers work with keyboard navigation', async ({
  page,
}) => {
  const scripts: string[] = [];
  const logos: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
    if (new URL(request.url()).pathname.startsWith('/logos/')) logos.push(request.url());
  });
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) failures.push(message.text());
  });
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'none'");
  expect(response?.headers()['content-security-policy']).not.toMatch(
    /unsafe-inline|unsafe-eval|\{\{/,
  );
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await expect(page.locator('img[src^="/logos/"]')).toHaveCount(0);
  await expect(page.locator('link[rel="preload"][href^="/logos/"]')).toHaveCount(0);
  expect(scripts.some((url) => /\/scan[.-]/.test(url))).toBe(false);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await controlTargets(page);
  await page.getByRole('link', { name: 'See exactly what we check' }).click();
  await expect(page.getByRole('heading', { name: 'What we look for' })).toBeVisible();
  await noOverflow(page);
  await page
    .locator('main')
    .getByRole('link', { name: 'zkSync Lite Withdraw After Shutdown', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'How to get it out' })).toBeVisible();
  await expect(page.locator('article')).toContainText('0x0a14B696350546110a0D8acDb86226983af9D2a0');
  await noOverflow(page);
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { name: 'Who receives requests' })).toBeVisible();
  await expect(page.locator('article')).toContainText(
    'RPC providers and our proxy see addresses scanned together from the same IP.',
  );
  await expect(page.locator('article')).toContainText(
    'Scanning one wallet at a time avoids this grouping.',
  );
  await noOverflow(page);
  expect(failures).toEqual([]);
  expect(logos).toEqual([]);
});

test('several wallets show the warning and start on Scan without a checkbox or earlier requests', async ({
  page,
}) => {
  const providers = await mockProviders(page);
  await page.goto('/');
  const scan = page.getByRole('button', { name: 'Scan', exact: true });
  await expect(scan).toBeEnabled();
  await scan.click();
  await expect(page.getByRole('alert')).toContainText('Paste at least one');
  await expect(page.getByLabel('Wallet addresses or ENS names')).toBeFocused();
  const input = page.getByLabel('Wallet addresses or ENS names');
  await input.fill('invalid input');
  await scan.click();
  await expect(page.getByRole('alert')).toContainText('No scan started');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('aria-describedby', 'input-help scan-error');
  await accessible(page);
  await input.fill([...PUBLIC_ADDRESSES, '0x0000000000000000000000000000000000000000'].join('\n'));
  await scan.click();
  await expect(page.getByRole('alert')).toContainText('up to 10');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('aria-describedby', 'input-help scan-error');
  expect(providers.count()).toBe(0);
  await accessible(page);
  await noOverflow(page);
  await input.fill(`${ADDRESS}, ${OTHER}`);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const warning = page.locator('#multi-wallet-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toHaveText(
    'Scanning several wallets can link them together. RPC providers and our proxy see these addresses together from the same IP. Scanning one wallet at a time avoids this grouping.',
  );
  await expect(warning).toHaveAttribute('aria-live', 'polite');
  await expect(warning).toHaveAttribute('aria-atomic', 'true');
  await expect(warning).not.toHaveAttribute('tabindex');
  await expect(input).toBeFocused();
  await expect(page.getByRole('link', { name: 'Who sees your scan?' })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(input).toHaveAttribute('aria-describedby', 'input-help');
  await input.fill(ADDRESS);
  await expect(warning).toBeEmpty();
  await input.fill(`${ADDRESS}, ${OTHER}`);
  await expect(warning).toBeVisible();
  await accessible(page);
  await controlTargets(page);
  expect(providers.count()).toBe(0);
  await scan.click();
  await expect(page.locator('.progress-line')).toContainText('Wallet 1 of 2');
  await expect.poll(providers.count).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toBeEmpty();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  providers.release();
  await expect(page.getByRole('heading', { name: 'Here is what turned up' })).toBeVisible();
});

test('shows real engine progress, unpriced findings and failures under CSP', async ({
  page,
}, testInfo) => {
  const providers = await mockProviders(page);
  const assets: string[] = [];
  page.on('request', (request) => assets.push(new URL(request.url()).pathname));
  let releaseStyles: () => void = () => {};
  const stylesGate = new Promise<void>((resolve) => {
    releaseStyles = resolve;
  });
  const scanStyles = /\/_astro\/scan\.[^/]+\.css$/;
  await page.route(scanStyles, async (route) => {
    await stylesGate;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  expect(assets.some((path) => /\/(?:scan|ScanViews)\./.test(path))).toBe(false);
  await page.getByLabel('Wallet addresses or ENS names').fill(ADDRESS);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect.poll(() => assets.some((path) => scanStyles.test(path))).toBe(true);
  expect(assets.some((path) => /\/ScanViews\.[^/]+\.js$/.test(path))).toBe(true);
  await expect(page.getByLabel('Wallet addresses or ENS names')).toBeVisible();
  await expect(page.locator('.network-board')).toHaveCount(0);
  expect(providers.count()).toBe(0);
  releaseStyles();
  await expect(
    page.getByRole('heading', { name: 'Looking for what you left behind' }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await expect(page.getByLabel('Wallet addresses or ENS names')).toBeHidden();
  await expect(page.getByRole('group', { name: 'Supported networks' })).toBeHidden();
  await expect(page.locator('.page > .hero')).toHaveCSS('position', 'absolute');
  await expect(
    page.locator('.scan-progress').getByText('Avoid address poisoning:', { exact: false }),
  ).toHaveCount(1);
  await expect(page.locator('#progress-title')).toBeFocused();
  await expect(page.getByRole('status')).toContainText(
    /Scanning wallet 1 of 1\. \d+ of 21 checks complete/,
  );
  await expect(page.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  await accessible(page);
  await page.getByText('Progress by wallet and check').click();
  await expect(page.locator('.scan-progress')).toContainText(ADDRESS);
  await noOverflow(page);
  await capture(page, testInfo.outputPath('scanning.png'));
  providers.release();
  await expect(page.getByRole('heading', { name: 'Here is what turned up' })).toBeVisible();
  await expect(page.locator('#report-title')).toBeFocused();
  await expect(page.locator('#report-title')).toHaveAttribute(
    'aria-describedby',
    'report-completion',
  );
  await expect(page.locator('.wallet-report')).toContainText('12.3456 USDC');
  const logo = page.locator('.wallet-report .finding img.protocol-logo').first();
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/logos/hyperliquid.svg');
  await expect(logo).toHaveAttribute('width', '24');
  await expect(logo).toHaveAttribute('height', '24');
  await expect(logo).toHaveAttribute('alt', '');
  await expect(logo).toHaveAttribute('loading', 'lazy');
  await expect(logo).toHaveAttribute('decoding', 'async');
  await expect(logo).toHaveCSS('width', '24px');
  await expect(logo).toHaveCSS('height', '24px');
  await expect(logo).toHaveCSS('object-fit', 'contain');
  await expect
    .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(
    page.locator('.wallet-report').getByText('Avoid address poisoning:', { exact: false }),
  ).toHaveCount(1);
  const wallet = page.locator('.wallet-report');
  await expect(wallet.locator('.finding')).toHaveCount(1);
  await expect(wallet.locator('.finding-subtitle')).toContainText('2 positions');
  await expect(wallet.locator('.finding-value .value')).toHaveText('≈ $12.34');
  await expect(wallet.locator('.finding-disclosure')).not.toHaveAttribute('open', '');
  await addressSafety(wallet);
  const details = wallet.locator('.finding-disclosure summary');
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(wallet.getByText('0.000000000000000001 UNKNOWN', { exact: true })).toBeVisible();
  await expect(details).toBeFocused();
  await accessible(page);
  await noOverflow(page);
  await page.keyboard.press('Space');
  await expect(wallet.getByRole('link', { name: 'Official app', exact: true })).toBeHidden();
  await expect(details).toBeFocused();
  await expect(page.locator('.report-summary .address-pill')).toHaveText(ADDRESS);
  await expect(page.locator('.network-board')).toHaveCount(1);
  await expect(page.locator('#report-completion')).toContainText(
    'Done · 1 thing found on 15 networks',
  );
  expect(
    await page
      .locator('.network-frame')
      .evaluate((board) => Boolean(board.nextElementSibling?.classList.contains('wallet-report'))),
  ).toBe(true);
  await expect(page.locator('.report-summary')).toContainText('≈ $12.34');
  await expect(page.locator('.report-summary')).toContainText('excluded from the total');
  await expect(page.getByRole('heading', { name: /Failed or partial/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing found (1)' })).toBeVisible();
  await accessibleAtCardArrival(page);
  await controlTargets(page);
  await noOverflow(page);
  await capture(page, testInfo.outputPath('report.png'));
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: '' });
  expect(new URL(page.url()).search).toBe('');
  await page.getByRole('button', { name: 'Clear addresses and results' }).click();
  await expect(page.getByLabel('Wallet addresses or ENS names')).toBeEmpty();
  await expect(page.locator('.wallet-report')).toHaveCount(0);
  await expect(page.getByLabel('Wallet addresses or ENS names')).toBeFocused();
});

test('keeps wholly unpriced groups folded, with dust and exact amounts available by keyboard', async ({
  page,
}) => {
  const providers = await mockProviders(page, 'unpriced');
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(ADDRESS);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.locator('#report-title')).toBeFocused();
  const wallet = page.locator('.wallet-report');
  await expect(wallet.locator('.finding')).toHaveCount(0);
  const unpriced = await foldButton(page, 'Show 1 unpriced finding');
  await unpriced.focus();
  await page.keyboard.press('Enter');
  await expect(unpriced).toBeFocused();
  await expect(wallet.locator('.finding-value .value')).toHaveText('< 0.0001 UNKNOWN');
  await expect(wallet.getByRole('img', { name: 'UNKNOWN', exact: true })).toHaveText('UNK+');
  await addressSafety(wallet);
  const details = wallet.locator('.finding-disclosure summary');
  await details.focus();
  await page.keyboard.press('Space');
  await expect(wallet.getByText('0.000000000000000001 UNKNOWN', { exact: true })).toBeVisible();
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
  await unpriced.focus();
  await page.keyboard.press('Space');
  await expect(unpriced).toHaveAttribute('aria-expanded', 'false');
  await expect(unpriced).toBeFocused();
  await expect(wallet.locator('.finding')).toHaveCount(0);
});

test('scans multiple wallets in order and respects reduced motion', async ({ page }) => {
  let exchanges = 0;
  const passes = new Set<string>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'proxy.deficheckup.test' || request.method() !== 'POST') return;
    if (url.pathname === '/scan-pass') exchanges++;
    else passes.add(request.headers()['x-scan-pass']!);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const providers = await mockProviders(page, 'empty');
  const second = OTHER;
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(`${ADDRESS}\n${second}\n${ADDRESS}`);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('wallet 1 of 2');
  await expect(page.locator('.magnifier')).toBeHidden();
  await accessible(page);
  providers.release();
  await expect(page.locator('#report-title')).toBeFocused();
  expect(exchanges).toBe(1);
  expect(passes.size).toBe(1);
  expect([...passes][0]).toMatch(/^v1\.[0-9]{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/);
  await expect(page.locator('.wallet-report')).toHaveCount(0);
  await expect(page.locator('.report-summary')).toContainText(
    '2 wallets scanned · 0 with findings',
  );
  await expect(page.locator('.network-board .network-tile')).toHaveCount(15);
  expect(providers.walletOrder.map((address) => address.toLowerCase())).toEqual(
    [ADDRESS, second].map((address) => address.toLowerCase()),
  );
  const empty = page.locator('.empty-results > summary');
  await expect(empty).toContainText('Nothing found in 4 completed checks');
  await empty.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.empty-results > .checked-list > li')).toHaveCount(2);
  await expect(page.locator('.empty-results')).toContainText(ADDRESS);
  await expect(page.locator('.empty-results')).toContainText(second);
  await expect(empty).toBeFocused();
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
});

test('keeps earlier wallet findings on the board while the next wallet scans', async ({ page }) => {
  const providers = await mockProviders(page, 'by-wallet', OTHER);
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(`${ADDRESS}\n${OTHER}`);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.locator('.progress-line')).toContainText('Wallet 2 of 2');
  const tile = page
    .locator('.network-board')
    .first()
    .locator('[data-network="hyperliquid"] .tile-status');
  await expect(tile).toHaveText('2 found · checking');
  providers.releaseWallet();
  await expect(page.locator('#report-title')).toBeFocused();
  await expect(page.locator('#report-completion')).toContainText(
    '≈ $12.34 · 1 thing found · 2 wallets scanned · 1 with findings',
  );
  await expect(page.locator('[data-network="hyperliquid"] .tile-status')).toHaveText(
    '2 found · checked',
  );
  const report = page.locator('.protocol-report');
  await addressSafety(report);
  await report.locator('.finding-disclosure > summary').click();
  await expect(report.locator('.finding-disclosure section')).toHaveCount(1);
  await expect(report.locator('.finding-disclosure section > .address')).toHaveText(ADDRESS);
  await accessible(page);
  await noOverflow(page);
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`keeps the interactive Turnstile checkbox beside Scan with motion ${reducedMotion}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    const providers = await mockProviders(page, 'turnstile-interactive');
    let exchanges = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/scan-pass') exchanges++;
    });
    await page.goto('/');
    const scan = page.getByRole('button', { name: 'Scan', exact: true });
    await expect(scan).toBeEnabled();
    const verification = page.locator('[aria-label="Browser verification"]');
    await expect(verification).toBeHidden();
    const inputBox = page.locator('.address-input');
    const help = page.locator('#input-help');
    const initialBox = (await inputBox.boundingBox())!;
    const initialHelp = (await help.boundingBox())!;
    expect(initialHelp.y - initialBox.y - initialBox.height).toBeCloseTo(22);
    await page.getByLabel('Wallet addresses or ENS names').fill(ADDRESS);
    await scan.click();
    const prompt = "Cloudflare needs one click to confirm you're human.";
    await expect(verification.getByText(prompt)).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(prompt);
    await expect(page.getByRole('button', { name: 'Verifying browser...' })).toBeDisabled();
    await expect(
      page.locator('.address-input + [aria-label="Browser verification"] + #input-help'),
    ).toHaveCount(1);
    const checkbox = page
      .frameLocator('iframe[title="Offline Cloudflare verification"]')
      .getByRole('checkbox', { name: 'Verify you are human' });
    await expect(checkbox).toBeVisible();
    await expect(verification).toBeInViewport({ ratio: 1 });
    await expect(page.locator('iframe[title="Offline Cloudflare verification"]')).toBeInViewport({
      ratio: 1,
    });
    expect(exchanges).toBe(0);
    expect(providers.count()).toBe(0);
    await accessible(page);
    await noOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('turnstile-interaction.png') });
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(verification).toBeHidden();
    await expect(page.getByRole('status')).toHaveText(
      'Verifying your browser before checking protocols.',
    );
    const afterBox = (await inputBox.boundingBox())!;
    const afterHelp = (await help.boundingBox())!;
    expect(afterHelp.y - afterBox.y - afterBox.height).toBeCloseTo(22);
    expect(exchanges).toBe(0);
    expect(providers.count()).toBe(0);
    providers.release();
    await page.evaluate(() => window.dispatchEvent(new Event('offline-turnstile-pass')));
    await expect(page.locator('#report-title')).toBeFocused();
    await expect(verification).toBeHidden();
    expect(exchanges).toBe(1);
    await noOverflow(page);
  });
}

for (const count of [1, 2]) {
  test(`a blocked Turnstile script leaves proxy failures and independent findings visible for ${count} wallets`, async ({
    page,
  }) => {
    const proxyRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).hostname === 'proxy.deficheckup.test')
        proxyRequests.push(request.url());
    });
    const providers = await mockProviders(page, 'turnstile-blocked');
    providers.release();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
    const addresses = PUBLIC_ADDRESSES.slice(0, count);
    await page.getByLabel('Wallet addresses or ENS names').fill(addresses.join('\n'));
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Checks that use our proxy could not be checked',
    );
    await expect(page.locator('#report-title')).toBeFocused();
    const report = page.locator(count === 1 ? '.wallet-report' : '.protocol-report');
    await expect(report).toBeVisible();
    await expect(page.locator('.report-summary')).toContainText('Failed or partial');
    await expect(report.locator('.finding')).toHaveCount(1);
    await expect(report.locator('.finding')).toContainText('Hyperliquid');
    if (count > 1) {
      await expect(page.locator('.wallet-report')).toHaveCount(0);
      await expect(report.locator('.finding-subtitle')).toHaveText('4 positions in 2 wallets');
      await report.locator('.finding-disclosure > summary').click();
      await expect(report.locator('.finding-disclosure section > .address')).toHaveText(addresses);
    }
    await page.getByRole('button', { name: /^Show \d+ failed or partial checks$/ }).click();
    const lite = report.locator('.failure-row').filter({ hasText: 'zkSync Lite' });
    await expect(lite).toHaveCount(1);
    await lite.locator('summary').click();
    await expect(lite).toContainText('Could not reach the zkSync Lite claim list.');
    if (count > 1) await expect(lite.locator('details .mono.address')).toHaveText(addresses);
    expect(proxyRequests).toEqual([]);
    await accessible(page);
    await noOverflow(page);
  });
}

test('a failed scan is not presented as an empty success', async ({ page }, testInfo) => {
  const providers = await mockProviders(page, 'error');
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(ADDRESS);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your scan needs another look' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing found this time' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show 21 failed or partial checks', exact: true }).click();
  const failed = page.locator('.failure-row').filter({ hasText: 'Merkl rewards' });
  await expect(failed.locator('img')).toHaveAttribute('src', '/logos/merkl.svg');
  await expect(failed.locator('img')).toHaveAttribute('width', '24');
  await expect(failed.locator('img')).toHaveAttribute('height', '24');
  await accessible(page);
  await noOverflow(page);
  await capture(page, testInfo.outputPath('error.png'));
});

test('limits Safe failure tiles to named networks when another multi-network service fails', async ({
  page,
}) => {
  const providers = await mockProviders(page, 'safe-limited');
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(ADDRESS);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.locator('#report-title')).toBeFocused();
  await expect(page.locator('.report-summary')).toContainText('Failed or partial: 20');
  await expect(page.locator('[data-network="base"] .tile-status')).toHaveText('incomplete');
  await expect(page.locator('[data-network="arbitrum"] .tile-status')).toHaveText('checked');
  await expect(page.locator('[data-network="polygon"] .tile-status')).toHaveText('checked');
  await page.getByRole('button', { name: 'Show 20 failed or partial checks', exact: true }).click();
  const safe = page.locator('.failure-row').filter({ hasText: 'Safes you own' });
  await expect(safe).toContainText(
    'We could not check your Safe balances and ownership, so there may be funds there.',
  );
  await expect(safe.locator('details')).not.toHaveAttribute('open', '');
  await expect(page.locator('.failure-row').filter({ hasText: 'Merkl rewards' })).toBeVisible();
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
});

test('groups all six Solana failures with closed reasons and keyboard access', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4321') external.push(`${url.hostname}${url.pathname}`);
  });
  const providers = await mockProviders(page, 'error');
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(stakeRecorded.address);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your scan needs another look' })).toBeVisible();
  await expect(page.locator('#report-title')).toBeFocused();
  await expect(page.locator('.report-summary')).toContainText('Failed or partial: 6');
  await expect(page.locator('.report-summary')).toContainText(
    'There may be more funds in the checks we could not complete.',
  );
  await expect(page.locator('[data-network="solana"] .tile-status')).toHaveText('incomplete');
  const toggle = await foldButton(page, 'Show 6 failed or partial checks');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toBeFocused();
  const notice = page.locator('.failure-notice');
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('Solana could not be checked right now. Try again later.');
  await expect(page.locator('.failure-row')).toHaveCount(0);
  await expect(page.locator('.wallet-report article')).toHaveCount(0);
  const details = notice.locator('details');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(notice.getByText('Technical reason:', { exact: false }).first()).toBeHidden();
  await accessible(page);
  await noOverflow(page);
  const summary = details.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(summary).toBeFocused();
  await expect(notice.locator('li')).toHaveCount(6);
  await expect(
    notice.getByText(
      'Technical reason: Solana stake accounts, clock or stake history could not be read.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(notice).toContainText(
    'We could not check SOL you may be able to withdraw from staking, so there may be funds there.',
  );
  await expect(page.getByRole('heading', { name: 'Nothing found this time' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /connect|sign/i })).toHaveCount(0);
  await expect(
    page.locator('.wallet-report').getByText('Avoid address poisoning:', { exact: false }),
  ).toHaveCount(1);
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
  await page.keyboard.press('Space');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();
  expect(external.length).toBeGreaterThan(0);
  // Besides the Solana route, only the Turnstile script and the scan pass may be requested.
  const turnstile = (url: string) =>
    url.startsWith('challenges.cloudflare.com/') || url === 'proxy.deficheckup.test/scan-pass';
  expect(external.filter((url) => !turnstile(url))).not.toHaveLength(0);
  expect(
    external
      .filter((url) => !turnstile(url))
      .every((url) => url === 'proxy.deficheckup.test/solana'),
  ).toBe(true);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: '' });
  expect(new URL(page.url()).search).toBe('');
});

test('keeps 158 findings short, sorts across protocols and supports keyboard folds', async ({
  page,
}, testInfo) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  const providers = await mockProviders(page, 'many');
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  await page.getByLabel('Wallet addresses or ENS names').fill(ADDRESS);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Here is what turned up' })).toBeVisible();
  await expect(page.locator('.report-summary')).toContainText('158 positions');
  await expect(page.locator('#report-completion')).toContainText('Done · 2 things found');
  await expect(page.locator('.report-summary')).toContainText(
    '48 priced · 110 unpriced (excluded from the total)',
  );
  expect((await page.locator('.report-summary').innerText()).match(/110 unpriced/g)).toHaveLength(
    1,
  );
  await accessibleAtCardArrival(page);
  await expect(page.locator('.report-summary')).toContainText('Failed or partial: 20');
  const cards = page.locator('.wallet-report .finding');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('.finding-value .value')).toHaveText(['≈ $2,202.34', '1 MERKL']);
  await expect(cards.locator('.finding-subtitle')).toHaveText([
    'Hyperliquid · 157 positions',
    'Ethereum · Unclaimed rewards',
  ]);
  await expect(cards.nth(1).getByRole('img', { name: 'MERKL', exact: true })).toHaveText('MERKL');
  await expect(cards.locator('.finding-disclosure[open]')).toHaveCount(0);
  await addressSafety(page.locator('.wallet-report'));
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(8000);
  await noOverflow(page);
  await page.locator('.report-summary').scrollIntoViewIfNeeded();
  await capture(page, testInfo.outputPath('many-findings.png'));

  const failed = await foldButton(page, 'Show 20 failed or partial checks');
  await failed.focus();
  await page.keyboard.press('Enter');
  await expect(failed).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByText(
      'We could not finish checking your unclaimed Merkl rewards, so there may be more funds there.',
      { exact: true },
    ),
  ).toBeVisible();
  const merkl = page.locator('.failure-row').filter({ hasText: 'Merkl rewards' });
  const reason = merkl.getByText('Some Merkl rewards could not be read.', { exact: true });
  await expect(reason).toBeHidden();
  const technical = merkl.locator('summary');
  await technical.focus();
  await page.keyboard.press('Enter');
  await expect(reason).toBeVisible();
  await expect(technical).toBeFocused();
  await accessible(page);
  await noOverflow(page);
  await page.keyboard.press('Space');
  await expect(reason).toBeHidden();
  await failed.focus();
  await expect(failed).toBeFocused();
  await page.keyboard.press('Space');
  await expect(failed).toHaveAttribute('aria-expanded', 'false');

  const details = cards.first().locator('.finding-disclosure summary');
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(cards.first().locator('.position-list > li')).toHaveCount(157);
  await expect(
    page.getByText('UNPRICED109 in your Hyperliquid spot account', { exact: false }),
  ).toBeVisible();
  await expect(details).toBeFocused();
  await accessible(page);
  await noOverflow(page);
  await page.keyboard.press('Space');
  await expect(details).toBeFocused();
  await expect(cards.first().getByRole('link', { name: 'Official app', exact: true })).toBeHidden();
  await expect(cards).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(cards.first()).toHaveCSS('animation-name', 'none');
  await expect(cards.first()).toHaveCSS('opacity', '1');
  await expect(cards.first()).toHaveCSS('background-color', 'rgb(21, 25, 35)');
  expect(failures).toEqual([]);
});

test('groups 10 wallets by protocol with ordered totals and keyboard disclosures', async ({
  page,
}, testInfo) => {
  // Allow for sequential wallets and provider timeouts when the whole suite runs in parallel.
  test.setTimeout(180_000);
  let exchanges = 0;
  const passes = new Set<string>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'proxy.deficheckup.test' || request.method() !== 'POST') return;
    if (url.pathname === '/scan-pass') exchanges++;
    else passes.add(request.headers()['x-scan-pass']!);
  });
  const providers = await mockProviders(page, 'many');
  providers.release();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeEnabled();
  const addresses = PUBLIC_ADDRESSES;
  await page.getByLabel('Wallet addresses or ENS names').fill(addresses.join('\n'));
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(providers.count()).toBe(0);
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Here is what turned up' })).toBeVisible({
    timeout: 110_000,
  });
  await expect(page.locator('#report-title')).toBeFocused();
  await expect(page.locator('.report-summary .address-pill')).toHaveText('10 wallets');
  await expect(page.locator('#report-completion')).toContainText(
    '≈ $27,023.45 · 2 things found · 10 wallets scanned · 10 with findings',
  );
  await expect(page.locator('.report-summary')).toContainText('1580 positions');
  await expect(page.locator('.report-summary')).toContainText('480 priced · 1100 unpriced');
  await expect(page.locator('.report-summary')).toContainText('Failed or partial: 200');
  expect(providers.walletOrder.map((address) => address.toLowerCase())).toEqual(
    addresses.map((address) => address.toLowerCase()),
  );
  expect(exchanges).toBe(1);
  expect(passes.size).toBe(1);
  expect([...passes][0]).toMatch(/^v1\.[0-9]{10}\.[a-f0-9]{32}\.[a-f0-9]{64}$/);
  const report = page.locator('.protocol-report');
  const cards = report.locator('.finding');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('.finding-value .value')).toHaveText(['≈ $22,023.45', '10 MERKL']);
  await expect(cards.locator('.finding-subtitle')).toHaveText([
    '1570 positions in 10 wallets',
    '10 positions in 10 wallets',
  ]);
  await expect(cards.first()).toContainText('1100 unpriced (excluded from the total)');
  await expect(report.locator('.finding-disclosure[open]')).toHaveCount(0);
  await expect(page.locator('.wallet-report')).toHaveCount(0);
  await addressSafety(report);
  await accessible(page);
  await noOverflow(page);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(8000);
  await page.locator('.report-summary').scrollIntoViewIfNeeded();
  await capture(page, testInfo.outputPath('many-wallets.png'));

  const details = cards.nth(1).locator('.finding-disclosure > summary');
  await details.focus();
  await page.keyboard.press('Enter');
  await expect(details).toBeFocused();
  const walletGroups = cards.nth(1).locator('.finding-disclosure section');
  await expect(walletGroups).toHaveCount(10);
  await expect(walletGroups.locator(':scope > .address')).toHaveText(addresses);
  await expect(cards.nth(1).getByRole('link', { name: 'Official app', exact: true })).toHaveCount(
    1,
  );
  await expect(cards.nth(1).getByRole('link', { name: 'Read our guide', exact: true })).toHaveCount(
    1,
  );
  await accessible(page);
  await noOverflow(page);
  await page.keyboard.press('Space');
  await expect(cards.nth(1).locator('.finding-disclosure')).not.toHaveAttribute('open', '');
  await expect(details).toBeFocused();

  const byWallet = report.locator('.by-wallet > summary');
  await expect(report.locator('.by-wallet')).not.toHaveAttribute('open', '');
  await byWallet.focus();
  await page.keyboard.press('Space');
  await expect(byWallet).toBeFocused();
  const walletTotals = report.locator('.by-wallet > .checked-list > li');
  await expect(walletTotals).toHaveCount(10);
  await expect(walletTotals.locator(':scope > .address')).toHaveText(addresses);
  for (const wallet of await walletTotals.all()) {
    await expect(wallet).toContainText('≈ $2,702.34 · 2 things found · 158 positions');
    await expect(wallet).toContainText('110 unpriced · Lost or fake: 0 · Failed or partial: 20');
  }
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
  await byWallet.focus();
  await page.keyboard.press('Enter');
  await expect(report.locator('.by-wallet')).not.toHaveAttribute('open', '');

  const failed = await foldButton(page, 'Show 200 failed or partial checks');
  await failed.focus();
  await page.keyboard.press('Enter');
  await expect(failed).toBeFocused();
  const merkl = report.locator('.failure-row').filter({ hasText: 'Merkl rewards' });
  await expect(merkl).toHaveCount(1);
  await expect(merkl).toContainText('Affected wallets: 10');
  await expect(merkl.locator('details')).not.toHaveAttribute('open', '');
  const technical = merkl.locator('summary');
  await technical.focus();
  await page.keyboard.press('Enter');
  await expect(technical).toBeFocused();
  await expect(merkl.locator('details .mono.address')).toHaveText(addresses);
  await expect(
    merkl.getByText('Some Merkl rewards could not be read.', { exact: true }),
  ).toHaveCount(10);
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(cards.first()).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('button', { name: /connect|sign/i })).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: '' });
  expect(new URL(page.url()).search).toBe('');
});

test('support copies complete destinations with keyboard feedback and no external requests', async ({
  page,
  context,
}, testInfo) => {
  const external: string[] = [];
  const failures: string[] = [];
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4321') {
      await route.continue();
    } else {
      external.push(route.request().url());
      await route.abort();
    }
  });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  const response = await page.goto('/support');
  expect(response?.status()).toBe(200);
  const csp = response!.headers()['content-security-policy'];
  expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|challenges\.cloudflare\.com|\{\{/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Support DeFi Checkup');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://deficheckup.com/support',
  );
  await expect(page.locator('main')).toContainText(
    'DeFi Checkup is free, open source and read only, with no token and no fees. If it helped you find something, a tip helps us keep going: adding more protocols and keeping every check up to date as they change.',
  );
  await expect(page.locator('.notice')).toContainText(
    'Tips are optional. DeFi Checkup never asks for a payment to show or recover your funds, and never asks you to connect a wallet or sign anything.',
  );
  await expect(page.locator('.notice')).toContainText(
    'Copy the full address and compare every character before sending. Send SOL and Solana tokens only to the Solana address, and EVM assets only to the EVM address.',
  );
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  const values = [SUPPORT.ens, SUPPORT.evm, SUPPORT.solana];
  await expect(page.locator('main .mono.address')).toHaveText(values);
  for (const address of await page.locator('main .mono.address').all()) {
    await expect(address).toHaveCSS('overflow-wrap', 'anywhere');
    expect(await address.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(
      'Geist Mono',
    );
    expect(await address.evaluate((element) => getComputedStyle(element).userSelect)).not.toBe(
      'none',
    );
  }
  await expect(page.getByRole('status')).toHaveCount(3);
  for (const [index, label] of ['ENS', 'EVM address', 'Solana address'].entries()) {
    const button = page.getByRole('button', { name: `Copy ${label}`, exact: true });
    await button.focus();
    await page.keyboard.press(index === 1 ? 'Space' : 'Enter');
    await expect(page.getByRole('status').nth(index)).toHaveText('Copied');
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(values[index]);
  }
  await page.getByRole('button', { name: 'Copy ENS', exact: true }).click();
  await expect(page.getByRole('status').first()).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SUPPORT.ens);
  await accessible(page);
  await controlTargets(page);
  await noOverflow(page);
  await capture(page, testInfo.outputPath('support.png'));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error('Clipboard denied')) },
    });
  });
  const copy = page.getByRole('button', { name: 'Copy Solana address', exact: true });
  await copy.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').last()).toHaveText(
    'Could not copy. Select and copy the full value.',
  );
  await expect(copy).toBeFocused();
  await expect(page.getByText(SUPPORT.solana, { exact: true })).toBeVisible();
  await accessible(page);
  await noOverflow(page);
  await expect(page.getByRole('button', { name: /connect|sign|scan/i })).toHaveCount(0);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie]),
  ).toEqual([0, 0, '']);
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
});

test('support destinations and warnings remain readable without JavaScript', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    baseURL: testInfo.project.use.baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/support');
    await expect(page.locator('main .mono.address')).toHaveText([
      SUPPORT.ens,
      SUPPORT.evm,
      SUPPORT.solana,
    ]);
    await expect(page.locator('.notice')).toContainText('Tips are optional.');
    await expect(page.locator('.notice')).toContainText('compare every character');
    await noOverflow(page);
  } finally {
    await context.close();
  }
});

test('every static route has metadata, semantic headings and no WCAG AA violations', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  await page.goto('/protocols');
  const guides = await page
    .locator('main h2 a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of ['/', '/protocols', '/privacy', '/closing-soon', '/support', ...guides]) {
    await page.goto(path);
    await expect(page.locator('img[src^="/logos/"]')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.locator('footer').getByRole('link', { name: 'Support the project' }),
    ).toHaveAttribute('href', '/support');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const art = artForGuide(path.replace(/\/$/, '').split('/').at(-1)!);
    const hero = page.locator('img.guide-hero');
    await expect(hero).toHaveCount(art ? 1 : 0);
    if (art) {
      // Both configured projects run this: 375px mobile and 1440px desktop.
      await page.evaluate(() => document.fonts.ready);
      const answer = await page.locator('.guide-intro > p').boundingBox();
      expect(answer).not.toBeNull();
      expect(answer!.y + answer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await expect(hero).toHaveAttribute('alt', art.alt);
      await expect(hero).toHaveAttribute('width', '1376');
      await expect(hero).toHaveAttribute('height', '768');
      await expect(hero).toHaveAttribute('loading', 'eager');
      await expect(hero).toHaveAttribute('srcset', /344w.*688w.*1032w.*1376w/);
      await noOverflow(page);
      await hero.scrollIntoViewIfNeeded();
      await expect(hero).toBeVisible();
      await expect(hero).toBeInViewport();
      await expect
        .poll(() => hero.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      expect(
        await hero.evaluate((image) => new URL((image as HTMLImageElement).currentSrc).origin),
      ).toBe('http://127.0.0.1:4321');
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        `https://deficheckup.com/social/${path.replace(/\/$/, '').split('/').at(-1)}.png`,
      );
    }
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(title.length).toBeGreaterThan(10);
    expect(description!.length).toBeGreaterThan(40);
    titles.add(title);
    descriptions.add(description!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://deficheckup.com${path.replace(/\/$/, '') || '/'}`,
    );
    await accessible(page);
    await controlTargets(page);
    await noOverflow(page);
  }
  expect(titles.size).toBe(guides.length + 5);
  expect(descriptions.size).toBe(guides.length + 5);
  const robots = await request.get('/robots.txt');
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toContain('Sitemap: https://deficheckup.com/sitemap.xml');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.headers()['content-type']).toContain('application/xml');
  expect((await sitemap.text()).match(/<loc>/g)).toHaveLength(guides.length + 5);
  for (const [path, type] of [
    ['/favicon.svg', 'image/svg+xml'],
    ['/favicon.ico', 'image/vnd.microsoft.icon'],
    ['/apple-touch-icon.png', 'image/png'],
    ['/logos/hyperliquid.svg', 'image/svg+xml'],
  ]) {
    if (!path!.startsWith('/logos/')) {
      const rel = path === '/apple-touch-icon.png' ? 'apple-touch-icon' : 'icon';
      await expect(page.locator(`link[rel="${rel}"][href="${path}"]`)).toHaveCount(1);
    }
    const icon = await request.get(path!);
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toBe(type);
    expect(icon.headers()['content-security-policy']).toContain("img-src 'self'");
  }
  expect(failures).toEqual([]);
});
