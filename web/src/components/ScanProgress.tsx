import type { Ref } from 'react';
import type { CheckRun, Network, Wallet } from '@deficheckup/engine';
import type { CheckInfo } from '../lib/catalog';
import { checksForAddress } from '../lib/catalog';
import { groupedFindings, VISIBLE_FINDINGS } from '../lib/report';
import { plural } from '../lib/plural';
import { AddressWarning, FindingCard } from './Report';
import NetworkBoard from './NetworkBoard';

export default function ScanProgress({
  checks,
  networks,
  wallets,
  walletIndex,
  finished,
  titleRef,
}: {
  checks: readonly CheckInfo[];
  networks: readonly Network[];
  wallets: readonly Wallet[];
  walletIndex: number;
  finished: readonly Pick<CheckRun, 'checkId' | 'address' | 'outcome'>[];
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const activeWallet = wallets[walletIndex]!;
  const activeChecks = checksForAddress(checks, activeWallet.address);
  const combinedChecks = checks.filter((check) =>
    wallets.some((wallet) => checksForAddress([check], wallet.address).length),
  );
  const combinedNetworks = networks.filter((network) =>
    combinedChecks.some((check) => check.networks.includes(network)),
  );
  const totalChecks = wallets.reduce(
    (total, wallet) => total + checksForAddress(checks, wallet.address).length,
    0,
  );
  return (
    <section className="scan-progress stack" aria-labelledby="progress-title">
      <p className="address-pill mono address">{activeWallet.address}</p>
      <h2 id="progress-title" className="screen-title" tabIndex={-1} ref={titleRef}>
        Looking for what you left behind
      </h2>
      <p className="progress-line">
        Wallet {walletIndex + 1} of {wallets.length} ·{' '}
        {finished.filter((run) => run.address === activeWallet.address).length} of{' '}
        {activeChecks.length} {plural(activeChecks.length, 'check')} complete
      </p>
      <progress aria-label="Overall scan progress" max={totalChecks} value={finished.length} />
      <NetworkBoard
        checks={combinedChecks}
        networks={combinedNetworks}
        finished={finished}
        addresses={wallets.map((wallet) => wallet.address)}
        scanning
      />
      <AddressWarning />
      <div className="card-grid live-findings" role="group" aria-label="Findings so far">
        {(() => {
          const groups = groupedFindings(
            finished
              .filter((run) => run.address === activeWallet.address)
              .map((run) => ({ ...run, durationMs: 0 })),
          );
          return [...groups.priced, ...groups.unpriced].slice(0, VISIBLE_FINDINGS).map((group) => {
            const check = checks.find((check) => check.id === group.checkId)!;
            return (
              <FindingCard
                key={check.id}
                check={check}
                finding={group.findings[0]!}
                group={group}
                index={checks.indexOf(check)}
              />
            );
          });
        })()}
      </div>
      <p className="subtitle">
        Showing up to {VISIBLE_FINDINGS} {plural(VISIBLE_FINDINGS, 'finding')} while scanning. All
        results will be available in the report.
      </p>
      <details>
        <summary>Progress by wallet and check</summary>
        <div className="stack">
          {wallets.map((wallet, index) => (
            <div className="panel stack" key={wallet.address}>
              <h3 className="mono address">{wallet.address}</h3>
              <ul className="checked-list">
                {checksForAddress(checks, wallet.address).map((check) => {
                  const result = finished.find(
                    (run) => run.address === wallet.address && run.checkId === check.id,
                  );
                  return (
                    <li key={check.id}>
                      {check.name}:{' '}
                      {result
                        ? result.outcome.kind === 'found' && result.outcome.partial
                          ? 'partial'
                          : result.outcome.kind
                        : index === walletIndex
                          ? 'checking'
                          : 'waiting'}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
