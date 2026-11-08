# DeFi Checkup

**Find overlooked balances across your wallets.**

**No wallet connection. No signatures.**

DeFi Checkup is a free, open-source web app. Paste public EVM or Solana addresses, or ENS names,
to look for balances that portfolio trackers can miss: forgotten positions, unclaimed rewards,
withdrawal requests and reclaimable account deposits.

Findings show token amounts, estimated values and recovery costs, known deadlines, a guide and a
link to the official app. The site only reads public data. It never sends transactions. Recovery
happens in the official app, under your control. Coverage is limited to the supported protocols
and markets. A failed or partial check does not mean a wallet has no funds.

This project is in development. Review findings and official recovery instructions before acting.

## Privacy

Addresses, ENS names and results stay in the current page's memory. The app does not put them in
URLs, cookies, browser storage or a database. Clear the report or reload to remove them. This
version has no analytics.

Public RPC and protocol API providers receive the addresses needed for their checks. Direct
providers see your IP address. The proxy receives your IP address and addresses in POST bodies
for Safe, zkSync Lite and Solana checks, then forwards the required data to their upstream services.
A scan accepts up to 10 addresses or ENS names and starts on submit, with no extra step for
multiple inputs. Scanning several wallets can let those services link them; scanning one at a
time avoids this grouping. Providers have their own data retention policies.
The scanner shows this warning near Scan for multiple inputs, with a link to the privacy page;
it never requires a checkbox or an extra click.

The proxy uses IP addresses for rate limiting. Automatic invocation logs and outgoing traces are
disabled, and application code does not log request data or errors containing it. Validated
eligibility and Safe balance responses may be cached for 10 minutes under hashed request keys.
Safe owner lists and Solana responses are never cached. Browser responses use `no-store`.

Never enter a seed phrase or private key. Copy an address from your own wallet, compare it in full,
and check the official domain before recovering funds. See the site's `/privacy` page for details.

## Run locally

Use Node 24 (see `.node-version`) and pnpm 12.16.1. From the repository root:

```bash
pnpm install --frozen-lockfile
PUBLIC_PROXY_URL=http://localhost:8787 pnpm --filter @deficheckup/web dev
```

Open `http://localhost:4321`. In another terminal, start the proxy:

```bash
pnpm --filter @deficheckup/proxy exec wrangler dev --env-file ../scripts/empty-dev-vars --var ALLOWED_ORIGINS:http://localhost:4321
```

The proxy listens on `http://localhost:8787`. This command runs without API keys. Safe requires a
`SAFE_API_KEY`; Solana uses the public mainnet fallback without `HELIUS_API_KEY`, which may reject
Worker requests. For full local coverage, copy `proxy/.dev.vars.example` to `proxy/.dev.vars`,
set your own provider keys there and keep the local allowed origin. Then start the proxy with
`pnpm --filter @deficheckup/proxy dev` instead. Keep keys out of source control. Requests made while
scanning use live providers; the normal tests do not.
Without a proxy, Safe, zkSync Lite and Solana checks report failures while other checks can run.

`PUBLIC_PROXY_URL` is embedded in the browser bundle. Set it in the process environment at startup
or build time. Never include a key or credential in it. Production URLs require HTTPS. The local
exception is `http://localhost:8787`.

Build and preview the static site:

```bash
PUBLIC_PROXY_URL=http://localhost:8787 pnpm build
pnpm --filter @deficheckup/web preview
```

Output is in `web/dist/`. The generated `_headers` file contains the production security policy;
Astro dev and preview do not apply it. Do not edit generated hashes. Adding an API host requires
updating the build's connection allowlist and the privacy page. Build checks enforce security
header limits and require identical policies across protocol guides.

## Test and contribute

```bash
CI=true pnpm check
pnpm build
```

`pnpm check` runs types, lint, formatting, offline Vitest tests and repository checks. Use
`CI=true` in a clean checkout to match the public CI configuration. Dependencies
use exact versions; new releases must be at least three days old. Workspace packages export
TypeScript source, so they need no separate build step. No API keys are needed for normal checks.

Browser tests use synthetic responses and documented public third-party fixtures. To run them,
install the pinned browser, then run Playwright and Lighthouse:

```bash
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright pnpm exec playwright install chromium
pnpm test:e2e
pnpm --filter @deficheckup/web lighthouse
```

The test server applies the generated security headers. Lighthouse reports are in
`test-results/lighthouse/`. Run it after Playwright, which clears `test-results/`.
`pnpm test:live` is separate: it makes network requests using documented public fixtures.
Never use personal wallet addresses in code, tests, issues or pull requests.

The main folders are `engine/` (read-only checks and RPC helpers), `catalog/` (protocols, tests and
guides), `web/` (Astro and React), `proxy/` (Cloudflare Worker), and `scripts/` (project checks).
Use `*.test.ts` for offline logic and fixtures, and `tests/e2e/*.spec.ts` for browser tests.

## Propose a protocol

Open an issue with the **Propose a protocol** form. Include the network, complete public contract
or program addresses, official sources, why balances are overlooked, recovery steps and any
recovery deadline with its timezone. Share public protocol information only.

To implement a check, start from `catalog/example/`. Add a folder with `check.ts`, `check.test.ts`
and `guide.en.md`, then register it in `catalog/index.ts`. Follow the `Check` type in
`engine/src/types.ts` and the catalog tests. Verify contracts on-chain and links on the official
domain before recording `verifiedOn`. Keep recorded RPC responses, blocks or slots, dates and
public source URLs beside the check. Tests must run offline. Use complete addresses everywhere.
Write guides in clear English and distinguish estimated costs, unknown values, partial coverage
and actual recovery deadlines. Run the checks and build before submitting a pull request.

## Catalog maintenance

The weekly workflow runs on Monday at 08:23 UTC and can be dispatched manually on `main` in a
non-fork repository. It runs the normal checks and build, then reads code for fixed catalog
contracts and Solana programs. It does not scan wallets or deploy the site. Code presence alone
does not prove that funds can be recovered.

It reports verification dates older than 60 UTC days, recovery deadlines within 30 UTC days and
missing or unavailable code. Confirm problems at official sources. Update verification dates only
after checking contracts, official links and recovery steps. Rebuild the site to update its
closing-soon page. Keep expired deadlines so the page can show them for another 30 days.

The workflow maintains three issues with titles starting `Catalog maintenance:`. It updates,
closes or reopens the same issues; do not rename them. See the complete job summary if an issue
omits rows. Missing code, unavailable verification, failed normal checks or issue synchronization
fail the job. Stale dates and approaching deadlines create issues without failing it. Investigate
provider outages and failed or interrupted runs, then rerun. The job uses `contents: read` and
`issues: write` permissions with the built-in GitHub token.

## Licenses and security

Code: [MIT](LICENSE). Guides and catalog descriptions: [CC BY 4.0](CONTENT-LICENSE.md).
Protocol names and logos belong to their owners and are excluded from those licenses. The
[logo manifest](web/src/lib/protocol-logos.ts) records sources. Bundled fonts retain their licenses.

Follow the [security policy](.github/SECURITY.md) to report a vulnerability privately. Do not put
exploit details, secrets or wallet data in a public issue.
