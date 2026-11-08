import { useEffect, useRef, useState } from 'react';
import type { CheckOutcome, CheckRun, Network, Wallet } from '@deficheckup/engine';
import type { CheckInfo } from '../lib/catalog';
import type * as ScanViews from './ScanViews';
import { checksForAddress, networkNames } from '../lib/catalog';
import { MAX_WALLETS, splitInputs } from '../lib/inputs';
import { plural } from '../lib/plural';

type Phase = 'idle' | 'resolving' | 'verifying' | 'scanning' | 'done' | 'failed';
const INTERACTION_PROMPT = "Cloudflare needs one click to confirm you're human.";
interface Finished {
  checkId: string;
  address: string;
  outcome: CheckOutcome;
}

export default function Scanner({
  checks,
  networks,
}: {
  checks: readonly CheckInfo[];
  networks: readonly Network[];
}) {
  const [ready, setReady] = useState(false);
  const [views, setViews] = useState<typeof ScanViews>();
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [inputError, setInputError] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [finished, setFinished] = useState<Finished[]>([]);
  const [runs, setRuns] = useState<CheckRun[]>([]);
  const [walletIndex, setWalletIndex] = useState(0);
  const [verificationInteractive, setVerificationInteractive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLHeadingElement>(null);
  const verificationRef = useRef<HTMLDivElement>(null);
  const verificationPanelRef = useRef<HTMLDivElement>(null);
  const latestProgress = useRef('');
  const busyRef = useRef(false);
  const resetInputFocus = useRef(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (phase === 'verifying' && verificationInteractive) {
      verificationPanelRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
  }, [phase, verificationInteractive]);
  useEffect(() => {
    if (phase === 'scanning' || phase === 'done' || phase === 'failed') statusRef.current?.focus();
    if (phase === 'idle' && resetInputFocus.current) {
      inputRef.current?.focus();
      resetInputFocus.current = false;
    }
  }, [phase]);
  const tokens = splitInputs(input);
  const busy = phase === 'resolving' || phase === 'verifying' || phase === 'scanning';
  const evmNetworkCount = networks.filter((n) => n !== 'hyperliquid' && n !== 'solana').length;
  const activeView = phase === 'scanning' || runs.length > 0;
  const activeWallet = wallets[walletIndex];
  const totalChecks = wallets.reduce(
    (total, wallet) => total + checksForAddress(checks, wallet.address).length,
    0,
  );
  const findingCount = finished.reduce(
    (sum, run) => sum + (run.outcome.kind === 'found' ? run.outcome.findings.length : 0),
    0,
  );
  const progressText = `Scanning wallet ${walletIndex + 1} of ${wallets.length}. ${finished.length} of ${totalChecks} ${plural(totalChecks, 'check')} complete. ${findingCount} ${plural(findingCount, 'finding')} so far.`;
  useEffect(() => {
    latestProgress.current = progressText;
  }, [progressText]);
  useEffect(() => {
    if (phase === 'scanning') {
      setAnnouncement(latestProgress.current);
      // Sample progress instead of announcing every concurrent check or finding.
      const timer = setInterval(() => setAnnouncement(latestProgress.current), 5000);
      return () => clearInterval(timer);
    }
    setAnnouncement(
      phase === 'resolving'
        ? 'Resolving your inputs. No protocol checks have started.'
        : phase === 'verifying'
          ? verificationInteractive
            ? INTERACTION_PROMPT
            : 'Verifying your browser before checking protocols.'
          : '',
    );
    return undefined;
  }, [phase, walletIndex, verificationInteractive]);
  useEffect(() => {
    if (error && inputError && !busy) inputRef.current?.focus();
  }, [error, inputError, busy]);

  async function scan() {
    if (busyRef.current) return;
    setError('');
    setInputError(false);
    if (!tokens.length) {
      setError('Paste at least one wallet address or ENS name.');
      setInputError(true);
      inputRef.current?.focus();
      return;
    }
    if (tokens.length > MAX_WALLETS) {
      setError(`Please scan up to ${MAX_WALLETS} addresses or ENS names at a time.`);
      setInputError(true);
      inputRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setPhase('resolving');
    setRuns([]);
    setFinished([]);
    try {
      const [runtime, loadedViews] = await Promise.all([
        import('../lib/scan'),
        import('./ScanViews'),
      ]);
      const {
        createCheckContext,
        createEnsResolver,
        resolveInputs,
        runChecks,
        checks: runnableChecks,
        createProxySession,
        requestScanToken,
        TEST_SITE_KEY,
      } = runtime;
      await loadedViews.loadStyles();
      setViews(loadedViews);
      const resolved = await resolveInputs(tokens, createEnsResolver());
      if (resolved.invalid.length) {
        setError(
          `No scan started. Fix these inputs or try resolving them again: ${resolved.invalid.join(', ')}. Enter EVM or Solana addresses, or ENS names.`,
        );
        setInputError(true);
        setPhase('idle');
        return;
      }
      setWallets(resolved.wallets);
      setWalletIndex(0);
      setPhase('verifying');
      const session = createProxySession({
        proxyUrl: import.meta.env.PUBLIC_PROXY_URL,
        token: () =>
          requestScanToken(
            verificationRef.current!,
            import.meta.env.DEV ? TEST_SITE_KEY : import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
            setVerificationInteractive,
          ),
        onFailure: setError,
      });
      // Finish verification outside the engine's 10-second check deadlines.
      await session.authorize();
      setPhase('scanning');
      const ctx = createCheckContext({
        proxyUrl: import.meta.env.PUBLIC_PROXY_URL,
        fetchFn: session.fetch,
      });
      const completed: CheckRun[] = [];
      // Keep checks concurrent within each wallet, but scan wallets in order to limit provider load.
      for (const [index, wallet] of resolved.wallets.entries()) {
        setWalletIndex(index);
        const result = await runChecks(runnableChecks, [wallet.address], ctx, {
          onProgress(progress) {
            if (progress.state === 'finished') setFinished((previous) => [...previous, progress]);
          },
        });
        completed.push(...result.runs);
        setRuns([...completed]);
      }
      setPhase('done');
    } catch {
      setError(
        'The scan could not finish. Check your connection and try again. Completed results are shown below.',
      );
      setPhase('failed');
    } finally {
      busyRef.current = false;
    }
  }

  function clear() {
    resetInputFocus.current = true;
    setInput('');
    setWallets([]);
    setRuns([]);
    setFinished([]);
    setError('');
    setInputError(false);
    setPhase('idle');
    if (phase === 'idle') inputRef.current?.focus();
  }

  return (
    <div className="scanner stack" data-results-view={activeView}>
      <div className="hero stack" hidden={activeView}>
        <form
          className="scan-form stack"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            void scan();
          }}
        >
          <label className="input-label" htmlFor="wallet-input">
            Wallet addresses or ENS names
          </label>
          <div className="address-input">
            <textarea
              ref={inputRef}
              id="wallet-input"
              name="wallet-input"
              rows={3}
              maxLength={12000}
              placeholder="Paste addresses or ENS names"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
              value={input}
              aria-describedby={`input-help${error && inputError ? ' scan-error' : ''}`}
              aria-invalid={Boolean(error) && inputError}
              onChange={(event) => {
                setInput(event.target.value);
                setInputError(false);
                setError('');
              }}
            />
            <button className="primary" type="submit" disabled={!ready || busy}>
              {phase === 'resolving'
                ? 'Resolving ENS...'
                : phase === 'verifying'
                  ? 'Verifying browser...'
                  : phase === 'scanning'
                    ? 'Scanning...'
                    : 'Scan'}
            </button>
          </div>
          <div
            ref={verificationPanelRef}
            className="stack"
            role="group"
            aria-label="Browser verification"
            hidden={phase !== 'verifying' || !verificationInteractive}
          >
            <p className="subtitle">{INTERACTION_PROMPT}</p>
            <div ref={verificationRef} />
          </div>
          <p id="input-help" className="subtitle">
            Up to {MAX_WALLETS} EVM or Solana addresses, or ENS names, one per line or separated by
            commas.{' '}
            <span id="multi-wallet-warning" aria-live="polite" aria-atomic="true">
              {tokens.length > 1 && (
                <>
                  Scanning several wallets can link them together. RPC providers and our proxy see
                  these addresses together from the same IP. Scanning one wallet at a time avoids
                  this grouping.{' '}
                </>
              )}
            </span>
            <a href="/privacy">Who sees your scan?</a>
          </p>
        </form>
        <div className="chips" role="group" aria-label="Supported networks">
          {networks.map((network) => (
            <span key={network} className="chip">
              {networkNames[network]}
            </span>
          ))}
        </div>
        <p className="subtitle">
          {checks.length} {plural(checks.length, 'check')} across {evmNetworkCount} EVM{' '}
          {plural(evmNetworkCount, 'network')}, Solana and Hyperliquid.{' '}
          <a href="/protocols">See exactly what we check</a>
        </p>
      </div>
      <p id="scan-error" className={error ? 'panel notice address' : 'sr-only'} role="alert">
        {error}
      </p>
      <p className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </p>
      {views && phase === 'scanning' && activeWallet && (
        <views.ScanProgress
          checks={checks}
          networks={networks}
          wallets={wallets}
          walletIndex={walletIndex}
          finished={finished}
          titleRef={statusRef}
        />
      )}
      {views && !busy && runs.length > 0 && (
        <views.Report
          titleRef={statusRef}
          complete={phase !== 'failed'}
          checks={checks}
          networks={networks}
          wallets={wallets.filter((wallet) => runs.some((run) => run.address === wallet.address))}
          runs={runs}
        />
      )}
      {!busy && (runs.length > 0 || input.length > 0) && (
        <div className="links">
          <button className="secondary" type="button" onClick={clear}>
            Clear addresses and results
          </button>
          {runs.length > 0 && (
            <button className="secondary" type="button" onClick={() => void scan()}>
              Scan again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
