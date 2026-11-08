import { useId, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import type { CheckRun, CheckFinding, Network, Wallet } from '@deficheckup/engine';
import type { CheckInfo } from '../lib/catalog';
import { checksForAddress, descriptions, networkNames } from '../lib/catalog';
import NetworkBoard from './NetworkBoard';
import { plural } from '../lib/plural';
import {
  displayTokenAmount,
  priceUnavailable,
  reportValue,
  tokenHeadline,
  groupedFindings,
  groupedProtocolFindings,
  groupedFailures,
  groupedScanFailures,
  failureMessage,
  failureReason,
  isIncomplete,
  positionLabels,
  tokenAmount,
  totals,
  usd,
} from '../lib/report';
import type { FindingGroup, ProtocolFindingGroup } from '../lib/report';
import TokenCoin from './TokenCoin';

export function CheckLinks({ check }: { check: CheckInfo }) {
  return (
    <div className="links">
      <a href={check.officialLink} target="_blank" rel="noopener noreferrer">
        {check.networks.includes('solana') ? 'Official guidance' : 'Official app'}
      </a>
      <a href={`/protocols/${check.id}/`}>Read our guide</a>
    </div>
  );
}

export function AddressWarning() {
  return (
    <p className="notice">
      Avoid address poisoning: always copy addresses from your own wallet, never from a transaction
      history, and compare them in full.
    </p>
  );
}

/** The adjacent heading carries the protocol name, so the image has empty alt text. */
export function ProtocolName({ check }: { check: CheckInfo }) {
  const logo = check.reportLogo;
  if (!logo) return <>{check.name}</>;
  return (
    <span className="protocol-name">
      <img
        className={`protocol-logo${logo.backdrop === 'ink' ? ' protocol-logo-ink' : ''}`}
        src={logo.file}
        width={24}
        height={24}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span>{check.name}</span>
    </span>
  );
}

function PositionDetails({ finding }: { finding: CheckFinding }) {
  return (
    <div className="position-details">
      <p className="subtitle address">
        {networkNames[finding.network]} · {finding.title}
      </p>
      <dl className="finding-details">
        <div>
          <dt>Exact amount</dt>
          <dd className="mono address">{tokenAmount(finding.amount)}</dd>
        </div>
        <div>
          <dt>USD value</dt>
          <dd>{priceUnavailable(finding) ? 'price unavailable' : usd(finding.valueUsd)}</dd>
        </div>
        <div>
          <dt>Estimated claim cost</dt>
          <dd>{usd(finding.claimCostUsd)}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{finding.deadline ?? 'No deadline reported. See the guide for conditions.'}</dd>
        </div>
        {finding.heldBy && (
          <div>
            <dt>{finding.network === 'solana' ? 'Holding account' : 'Holding contract'}</dt>
            <dd className="mono address">{finding.heldBy}</dd>
          </div>
        )}
      </dl>
      {finding.note && <p className="notice address">{finding.note}</p>}
    </div>
  );
}

export function FindingCard({
  finding,
  group,
  check,
  index,
  headingLevel = 3,
  report = false,
}: {
  finding: CheckFinding;
  group?: FindingGroup | ProtocolFindingGroup;
  check: CheckInfo;
  index: number;
  headingLevel?: 3 | 4 | 5;
  report?: boolean;
}) {
  const Heading = `h${headingLevel}` as const;
  const findings = group?.findings ?? [finding];
  const multiple = findings.length > 1;
  const protocol = group && 'wallets' in group ? group : undefined;
  const unavailable = findings.filter(priceUnavailable).length;
  const hasKnownValue = findings.some((position) => position.valueUsd !== null);
  const primaryValue =
    unavailable && !hasKnownValue
      ? protocol?.amount
        ? displayTokenAmount(protocol.amount)
        : tokenHeadline(findings)
      : protocol
        ? protocol.amount
          ? displayTokenAmount(protocol.amount)
          : protocol.valueUsd === null
            ? `${findings.length} ${plural(findings.length, 'position')}`
            : usd(protocol.valueUsd)
        : multiple && group
          ? group.valueUsd === null
            ? `${findings.length} positions`
            : usd(group.valueUsd)
          : displayTokenAmount(finding.amount);
  const estimate = protocol
    ? protocol.amount
      ? usd(protocol.valueUsd)
      : protocol.valueUsd === null
        ? usd(null)
        : protocol.unpriced
          ? 'known value'
          : 'total'
    : multiple && group
      ? group.valueUsd === null
        ? usd(null)
        : group.unpriced
          ? 'known value'
          : 'total'
      : usd(finding.valueUsd);
  const secondaryValue = unavailable
    ? hasKnownValue
      ? `${estimate === 'total' || estimate === 'known value' ? 'known value' : `${estimate} known`}, prices unavailable for ${unavailable}`
      : 'price unavailable'
    : estimate;
  const symbols = new Set(findings.map((position) => position.amount?.symbol ?? 'POS'));
  const networks = [...new Set(findings.map((position) => position.network))];
  const deadlines = [
    ...new Set(findings.flatMap((position) => (position.deadline ? [position.deadline] : []))),
  ].sort();
  return (
    <article className="panel finding">
      <div className="finding-heading">
        <TokenCoin symbol={symbols.size === 1 ? [...symbols][0]! : 'POS'} index={index} />
        <div>
          <Heading>{report ? <ProtocolName check={check} /> : check.name}</Heading>
          <p className="subtitle finding-subtitle">
            {protocol ? (
              `${findings.length} ${plural(findings.length, 'position')} in ${protocol.wallets.length} ${plural(protocol.wallets.length, 'wallet')}`
            ) : (
              <>
                {networks.length === 1 ? networkNames[networks[0]!] : `${networks.length} networks`}{' '}
                ·{' '}
                {multiple
                  ? `${findings.length} positions`
                  : (positionLabels[check.id] ?? 'Position')}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="finding-value">
        <p className="value">{primaryValue}</p>
        <p className="mono subtitle">{secondaryValue}</p>
      </div>
      {unavailable > 0 && hasKnownValue && (
        <p className="mono subtitle address">
          {tokenHeadline(findings.filter(priceUnavailable))} · price unavailable
        </p>
      )}
      {Boolean(group?.unpriced) && (multiple || protocol) && (
        <p className="subtitle">{group!.unpriced} unpriced (excluded from the total)</p>
      )}
      {deadlines.length > 0 && <p className="notice subtitle">Claim by {deadlines.join(' · ')}</p>}
      <details className="finding-disclosure">
        <summary>
          Details<span className="sr-only"> for {check.name}</span>
        </summary>
        {Boolean(group?.unpriced) && (
          <p className="notice subtitle">
            Unpriced positions may include spam or dust. Verify each token and read the guide before
            taking action.
          </p>
        )}
        {protocol ? (
          <div className="stack">
            {protocol.wallets.map(({ address, findings, notices }) => (
              <section className="stack" key={address} aria-label={`Positions in ${address}`}>
                <p className="mono address">{address}</p>
                <ol className="position-list">
                  {findings.map((position, index) => (
                    <li key={index}>
                      <PositionDetails finding={position} />
                    </li>
                  ))}
                </ol>
                {notices.map((notice, index) => (
                  <p className="notice address" key={index}>
                    {notice}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : multiple ? (
          <ol className="position-list">
            {findings.map((position, index) => (
              <li key={index}>
                <PositionDetails finding={position} />
              </li>
            ))}
          </ol>
        ) : (
          <PositionDetails finding={finding} />
        )}
        <CheckLinks check={check} />
      </details>
    </article>
  );
}

/** The toggle stays mounted and focused; collapsed contents do not occupy the DOM. */
function Fold({
  label,
  expandedLabel = label,
  children,
}: {
  label: string;
  expandedLabel?: string;
  children: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="stack">
      <button
        className="secondary"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? expandedLabel : label}
      </button>
      <div id={id} hidden={!open}>
        {open && children()}
      </div>
    </div>
  );
}

/** Native disclosures keep technical reasons available without repeating large failure cards. */
export function FailedChecks({
  checks,
  runs,
  multiWallet = false,
}: {
  checks: readonly CheckInfo[];
  runs: readonly CheckRun[];
  multiWallet?: boolean;
}) {
  const failures = multiWallet ? groupedScanFailures(checks, runs) : undefined;
  const single = failures ? undefined : groupedFailures(checks, runs);
  const groups = failures?.groups ?? single!.groups;
  const individual = failures?.individual ?? single!.individual.map((entry) => [entry]);
  function affected(entries: readonly { run: CheckRun }[]) {
    const count = new Set(entries.map(({ run }) => run.address)).size;
    return <p className="subtitle">Affected wallets: {count}</p>;
  }
  return (
    <div className="stack failure-list">
      {groups.map(({ network, entries }) => (
        <div className="notice failure-notice" key={network}>
          <p>{networkNames[network]} could not be checked right now. Try again later.</p>
          {multiWallet && affected(entries)}
          <details>
            <summary>
              Affected checks ({entries.length})
              <span className="sr-only"> on {networkNames[network]}</span>
            </summary>
            <ul className="checked-list">
              {entries.map(({ check, run }) => (
                <li key={`${run.address}:${check.id}`}>
                  {multiWallet && <p className="mono address">{run.address}</p>}
                  <strong>
                    <ProtocolName check={check} />
                  </strong>
                  <p className="subtitle">{failureMessage(check, run.outcome)}</p>
                  <p className="subtitle address">Technical reason: {failureReason(run.outcome)}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
      {individual.length > 0 && (
        <ul className="failure-rows">
          {individual.map((entries) => {
            const { check } = entries[0]!;
            return (
              <li className="failure-row" key={check.id}>
                <p>
                  <strong>
                    <ProtocolName check={check} />
                  </strong>
                </p>
                {[...new Set(entries.map(({ run }) => failureMessage(check, run.outcome)))].map(
                  (message) => (
                    <p className="subtitle" key={message}>
                      {message}
                    </p>
                  ),
                )}
                <p className="subtitle">Try again later. Any balances found are kept.</p>
                {multiWallet && affected(entries)}
                <details>
                  <summary>
                    Technical details<span className="sr-only"> for {check.name}</span>
                  </summary>
                  {entries.map(({ run }) => (
                    <div className="position-details" key={run.address}>
                      {multiWallet && <p className="mono address">{run.address}</p>}
                      <p className="subtitle address">{failureReason(run.outcome)}</p>
                      {'failedNetworks' in run.outcome &&
                        Boolean(run.outcome.failedNetworks?.length) && (
                          <p className="subtitle">
                            Affected networks:{' '}
                            {run.outcome
                              .failedNetworks!.map((network) => networkNames[network])
                              .join(', ')}
                          </p>
                        )}
                    </div>
                  ))}
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProtocolReport({
  wallets,
  runs,
  checks,
}: {
  wallets: readonly Wallet[];
  runs: readonly CheckRun[];
  checks: readonly CheckInfo[];
}) {
  const { priced, unpriced } = groupedProtocolFindings(runs);
  const findingLabel = priced.some((group) => group.pricesUnavailable)
    ? 'Findings'
    : `Priced ${plural(priced.length, 'finding')}`;
  const incomplete = runs.filter((run) => isIncomplete(run.outcome));
  const nothing = runs.filter((run) => run.outcome.kind === 'nothing' && !run.outcome.note);
  const lost = runs.filter((run) => run.outcome.kind === 'lost' || run.outcome.kind === 'fake');
  const notices = runs.filter((run) => run.outcome.kind === 'nothing' && run.outcome.note);
  function cards(groups: ProtocolFindingGroup[]) {
    return groups.map((group) => {
      const check = checks.find((check) => check.id === group.checkId)!;
      return (
        <FindingCard
          key={check.id}
          check={check}
          finding={group.findings[0]!}
          group={group}
          index={checks.indexOf(check)}
          headingLevel={4}
          report
        />
      );
    });
  }
  function outcomeGroups(entries: readonly CheckRun[], kind: 'lost' | 'notices') {
    return [...new Set(entries.map((run) => run.checkId))].map((checkId) => {
      const check = checks.find((check) => check.id === checkId)!;
      const matching = entries.filter((run) => run.checkId === checkId);
      return (
        <article className="panel stack" key={checkId}>
          <h4>
            <ProtocolName check={check} />
            {kind === 'notices' ? ': other notices' : ''}
          </h4>
          <details>
            <summary>
              {matching.length} {plural(matching.length, 'wallet')}
              <span className="sr-only">
                : {check.name} {kind === 'lost' ? 'lost or fake' : 'notices'}
              </span>
            </summary>
            <ul className="checked-list">
              {matching.map((run) => (
                <li key={run.address}>
                  <p className="mono address">{run.address}</p>
                  {'reason' in run.outcome && (
                    <p className="address">
                      {run.outcome.kind}: {run.outcome.reason}
                    </p>
                  )}
                  {run.outcome.kind === 'nothing' && (
                    <p className="notice address">{run.outcome.note}</p>
                  )}
                </li>
              ))}
            </ul>
            <CheckLinks check={check} />
          </details>
        </article>
      );
    });
  }
  return (
    <div className="protocol-report stack">
      <AddressWarning />
      <section className="stack" aria-label={findingLabel}>
        <h3 className="sr-only">
          {findingLabel} ({priced.length})
        </h3>
        {priced.length ? (
          <div className="card-grid">{cards(priced)}</div>
        ) : (
          <p className="subtitle">
            {incomplete.length
              ? 'No priced balances could be confirmed.'
              : 'No priced balances found in the completed checks.'}
          </p>
        )}
      </section>
      {unpriced.length > 0 && (
        <section className="stack" aria-label={`Unpriced ${plural(unpriced.length, 'finding')}`}>
          <h3>Without a USD price ({unpriced.length})</h3>
          <p className="subtitle">
            Excluded from the total. These may include spam or dust. Review the guide and verify the
            token before taking action.
          </p>
          <Fold
            label={`Show ${unpriced.length} unpriced ${plural(unpriced.length, 'finding')}`}
            expandedLabel={`Hide ${unpriced.length} unpriced ${plural(unpriced.length, 'finding')}`}
          >
            {() => <div className="card-grid">{cards(unpriced)}</div>}
          </Fold>
        </section>
      )}
      {notices.length > 0 && (
        <section className="stack">
          <h3>Other notices</h3>
          {outcomeGroups(notices, 'notices')}
        </section>
      )}
      {lost.length > 0 && (
        <section className="stack">
          <h3>Lost or fake ({lost.length})</h3>
          {outcomeGroups(lost, 'lost')}
        </section>
      )}
      {incomplete.length > 0 && (
        <section className="stack">
          <h3>Failed or partial ({incomplete.length})</h3>
          <Fold
            label={`Show ${incomplete.length} failed or partial ${plural(incomplete.length, 'check')}`}
            expandedLabel={`Hide ${incomplete.length} failed or partial ${plural(incomplete.length, 'check')}`}
          >
            {() => <FailedChecks checks={checks} runs={runs} multiWallet />}
          </Fold>
        </section>
      )}
      {nothing.length > 0 ? (
        <details className="empty-results">
          <summary>
            Nothing found in {nothing.length} completed {plural(nothing.length, 'check')}
            <span className="sr-only">: empty results by wallet</span>
          </summary>
          <p className="subtitle">
            Only completed, empty checks are listed here. This scan does not cover every protocol or
            token.
          </p>
          <ul className="checked-list">
            {wallets.map((wallet) => {
              const empty = nothing.filter((run) => run.address === wallet.address);
              return empty.length > 0 ? (
                <li key={wallet.address}>
                  <p className="mono address">{wallet.address}</p>
                  <ul className="checked-list">
                    {empty.map((run) => (
                      <li key={run.checkId}>
                        <a href={`/protocols/${run.checkId}/`}>
                          {checks.find((check) => check.id === run.checkId)!.name}
                        </a>
                        {run.outcome.kind === 'nothing' && run.outcome.alreadyClaimed
                          ? ': already claimed'
                          : ': nothing found'}
                      </li>
                    ))}
                  </ul>
                </li>
              ) : null;
            })}
          </ul>
        </details>
      ) : (
        <p className="subtitle">No checks returned an empty result.</p>
      )}
      <details className="by-wallet">
        <summary>By wallet</summary>
        <ul className="checked-list">
          {wallets.map((wallet) => {
            const own = runs.filter((run) => run.address === wallet.address);
            const total = totals(own);
            const groups = groupedFindings(own);
            const count = groups.priced.length + groups.unpriced.length;
            return (
              <li key={wallet.address}>
                <p className="mono address">{wallet.address}</p>
                {wallet.input !== wallet.address && (
                  <p className="subtitle address">Entered as {wallet.input}</p>
                )}
                <p className="mono subtitle">
                  {reportValue(own)} · {count} {plural(count, 'thing')} found · {total.count}{' '}
                  {plural(total.count, 'position')}
                </p>
                <p className="subtitle">
                  {total.unpriced} unpriced ·{' '}
                  {total.pricesUnavailable > 0 && (
                    <>Prices unavailable: {total.pricesUnavailable} · </>
                  )}
                  Lost or fake:{' '}
                  {
                    own.filter((run) => run.outcome.kind === 'lost' || run.outcome.kind === 'fake')
                      .length
                  }{' '}
                  · Failed or partial: {total.incomplete}
                </p>
                {total.count === 0 && (
                  <p className="subtitle">
                    {total.incomplete ||
                    own.length < checksForAddress(checks, wallet.address).length
                      ? 'No findings confirmed; some checks could not be completed.'
                      : 'No overlooked balances found in the completed checks.'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

function WalletReport({
  wallet,
  runs,
  checks,
  networks,
  collapsible,
}: {
  wallet: Wallet;
  runs: readonly CheckRun[];
  checks: readonly CheckInfo[];
  networks: readonly Network[];
  collapsible: boolean;
}) {
  const SectionHeading = collapsible ? 'h4' : 'h3';
  const CardHeading = collapsible ? 'h5' : 'h4';
  const [open, setOpen] = useState(!collapsible);
  const id = useId();
  const total = totals(runs);
  const { priced, unpriced } = groupedFindings(runs);
  const findingLabel = priced.some((group) => group.pricesUnavailable)
    ? 'Findings'
    : `Priced ${plural(priced.length, 'finding')}`;
  const found = runs.filter((run) => run.outcome.kind === 'found');
  const lost = runs.filter((run) => run.outcome.kind === 'lost' || run.outcome.kind === 'fake');
  const nothing = runs.filter((run) => run.outcome.kind === 'nothing' && !run.outcome.note);
  const informational = runs.filter((run) => run.outcome.kind === 'nothing' && run.outcome.note);
  const applicableChecks = checksForAddress(checks, wallet.address);
  const applicableNetworks = networks.filter((network) =>
    applicableChecks.some((check) => check.networks.includes(network)),
  );
  const incomplete = runs.filter((run) => isIncomplete(run.outcome));
  function cards(entries: typeof priced) {
    return entries.map((group) => {
      const { checkId } = group;
      const check = checks.find((check) => check.id === checkId)!;
      return (
        <FindingCard
          key={checkId}
          check={check}
          finding={group.findings[0]!}
          group={group}
          index={checks.indexOf(check)}
          headingLevel={collapsible ? 5 : 4}
          report
        />
      );
    });
  }
  return (
    <section className="wallet-report stack" aria-label={`Report for ${wallet.address}`}>
      {collapsible && (
        <>
          <h3 className="mono address wallet-title">
            <button
              type="button"
              className="secondary wallet-toggle"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen(!open)}
            >
              {open ? 'Hide' : 'Show'} wallet: {wallet.address}
            </button>
          </h3>
          {wallet.input !== wallet.address && (
            <p className="mono address subtitle">Entered as {wallet.input}</p>
          )}
          <p className="mono subtitle">
            {reportValue(runs)} · {total.count} {plural(total.count, 'position')} ·{' '}
            {total.count - total.unpriced - total.pricesUnavailable} priced · {total.unpriced}{' '}
            unpriced
          </p>
          <p className="subtitle">
            Lost or fake: {lost.length} · Failed or partial: {incomplete.length}
          </p>
        </>
      )}
      <AddressWarning />
      <div id={id} hidden={!open}>
        {open && (
          <div className="stack">
            <section className="stack" aria-label={findingLabel}>
              <SectionHeading className="sr-only">
                {findingLabel} ({priced.length})
              </SectionHeading>
              {priced.length > 0 ? (
                <div className="card-grid">{cards(priced)}</div>
              ) : (
                <p className="subtitle">
                  {incomplete.length > 0
                    ? 'No priced balances could be confirmed.'
                    : 'No priced balances found in the completed checks.'}
                </p>
              )}
            </section>
            {unpriced.length > 0 && (
              <section
                className="stack"
                aria-label={`Unpriced ${plural(unpriced.length, 'finding')}`}
              >
                <SectionHeading>Without a USD price ({unpriced.length})</SectionHeading>
                <p className="subtitle">
                  Excluded from the total. These may include spam or dust. Review the guide and
                  verify the token before taking action.
                </p>
                <Fold
                  label={`Show ${unpriced.length} unpriced ${plural(unpriced.length, 'finding')}`}
                  expandedLabel={`Hide ${unpriced.length} unpriced ${plural(unpriced.length, 'finding')}`}
                >
                  {() => <div className="card-grid">{cards(unpriced)}</div>}
                </Fold>
              </section>
            )}
            {found.map((run) =>
              run.outcome.kind === 'found' && run.outcome.notices?.length ? (
                <div className="panel stack" key={run.checkId}>
                  <SectionHeading>
                    {checks.find((check) => check.id === run.checkId)!.name}: other notices
                  </SectionHeading>
                  {run.outcome.notices.map((notice, index) => (
                    <p className="address" key={index}>
                      {notice}
                    </p>
                  ))}
                </div>
              ) : null,
            )}
            {lost.length > 0 && (
              <section className="stack">
                <SectionHeading>Lost or fake ({lost.length})</SectionHeading>
                {lost.map((run) => {
                  const check = checks.find((check) => check.id === run.checkId)!;
                  return (
                    <article key={run.checkId} className="panel stack">
                      <CardHeading>
                        <ProtocolName check={check} />:{' '}
                        {run.outcome.kind === 'lost' ? 'lost' : 'fake'}
                      </CardHeading>
                      <p>{'reason' in run.outcome && run.outcome.reason}</p>
                      <CheckLinks check={check} />
                    </article>
                  );
                })}
              </section>
            )}
            {incomplete.length > 0 && (
              <section className="stack">
                <SectionHeading>Failed or partial ({incomplete.length})</SectionHeading>
                <Fold
                  label={`Show ${incomplete.length} failed or partial ${plural(incomplete.length, 'check')}`}
                  expandedLabel={`Hide ${incomplete.length} failed or partial ${plural(incomplete.length, 'check')}`}
                >
                  {() => <FailedChecks checks={applicableChecks} runs={runs} />}
                </Fold>
              </section>
            )}
            {collapsible && (
              <Fold label="Show network coverage" expandedLabel="Hide network coverage">
                {() => (
                  <NetworkBoard
                    checks={applicableChecks}
                    networks={applicableNetworks}
                    finished={runs}
                    address={wallet.address}
                  />
                )}
              </Fold>
            )}
            {informational.map((run) => {
              const check = checks.find((check) => check.id === run.checkId)!;
              return (
                <article className="panel stack" key={run.checkId}>
                  <SectionHeading>{check.name}</SectionHeading>
                  <p className="notice address">
                    {run.outcome.kind === 'nothing' ? run.outcome.note : ''}
                  </p>
                  <CheckLinks check={check} />
                </article>
              );
            })}
            <section className="stack">
              <SectionHeading>Nothing found ({nothing.length})</SectionHeading>
              <p className="subtitle">
                {nothing.length
                  ? plural(
                      nothing.length,
                      'This check found no overlooked balance in its supported markets.',
                      'These checks found no overlooked balance in their supported markets.',
                    )
                  : 'No checks returned an empty result.'}{' '}
                This scan does not cover every protocol or token.
              </p>
              {nothing.length > 0 && (
                <Fold
                  label={`Show ${nothing.length} empty ${plural(nothing.length, 'check')}`}
                  expandedLabel={`Hide ${nothing.length} empty ${plural(nothing.length, 'check')}`}
                >
                  {() => (
                    <ul className="checked-list">
                      {nothing.map((run) => (
                        <li key={run.checkId}>
                          <a href={`/protocols/${run.checkId}/`}>
                            {checks.find((check) => check.id === run.checkId)!.name}
                          </a>
                          {run.outcome.kind === 'nothing' && run.outcome.alreadyClaimed
                            ? ': already claimed'
                            : ': nothing found'}
                          <p className="subtitle">{descriptions[run.checkId]}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Fold>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Report({
  wallets,
  runs,
  checks,
  networks,
  titleRef,
  complete = true,
}: {
  complete?: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
  wallets: readonly Wallet[];
  runs: readonly CheckRun[];
  checks: readonly CheckInfo[];
  networks: readonly Network[];
}) {
  const total = totals(runs);
  const multiWallet = wallets.length > 1;
  const groups = multiWallet ? groupedProtocolFindings(runs) : groupedFindings(runs);
  const count = groups.priced.length + groups.unpriced.length;
  const walletsWithFindings = wallets.filter((wallet) =>
    runs.some((run) => run.address === wallet.address && run.outcome.kind === 'found'),
  ).length;
  const scannedWallets = wallets.filter((wallet) =>
    runs.some((run) => run.address === wallet.address),
  ).length;
  const applicableChecks = checks.filter((check) =>
    wallets.some((wallet) => checksForAddress([check], wallet.address).length),
  );
  const applicableNetworks = networks.filter((network) =>
    applicableChecks.some((check) => check.networks.includes(network)),
  );
  const lost = runs.filter(
    (run) => run.outcome.kind === 'lost' || run.outcome.kind === 'fake',
  ).length;
  return (
    <section className="stack" aria-labelledby="report-title">
      <div className="report-summary scan-progress stack">
        <p className="address-pill mono address">
          {wallets.length === 1 ? wallets[0]!.address : `${wallets.length} wallets`}
        </p>
        <h2
          id="report-title"
          className="screen-title"
          tabIndex={-1}
          ref={titleRef}
          aria-describedby="report-completion"
        >
          {!complete
            ? 'Your scan stopped early'
            : total.count
              ? 'Here is what turned up'
              : total.incomplete
                ? 'Your scan needs another look'
                : 'Nothing found this time'}
        </h2>
        <p id="report-completion" className="progress-line">
          {multiWallet ? (
            <>
              {complete ? 'Done' : 'Interrupted'} · {reportValue(runs)} · {count}{' '}
              {plural(count, 'thing')} found ·{' '}
              {complete ? wallets.length : `${scannedWallets} of ${wallets.length}`} wallets scanned
              · {walletsWithFindings} with findings
            </>
          ) : (
            <>
              {complete ? 'Done' : 'Interrupted'} · {count} {plural(count, 'thing')} found on{' '}
              {applicableNetworks.length} {plural(applicableNetworks.length, 'network')} ·{' '}
              {reportValue(runs)}
            </>
          )}
        </p>
        <p className="subtitle report-counts">
          {total.count} {plural(total.count, 'position')} ·{' '}
          {total.count - total.unpriced - total.pricesUnavailable} priced · {total.unpriced}{' '}
          unpriced (excluded from the total) ·{' '}
          {total.pricesUnavailable > 0 && <>Prices unavailable: {total.pricesUnavailable} · </>}
          Lost or fake: {lost} · Failed or partial: {total.incomplete}
          {total.incomplete > 0
            ? '. There may be more funds in the checks we could not complete.'
            : ''}
        </p>
        {total.pricesUnavailable > 0 && (
          <p className="notice subtitle">
            Prices unavailable right now for {total.pricesUnavailable}{' '}
            {plural(total.pricesUnavailable, 'finding')}. Amounts are shown in tokens; try again in
            a minute.
          </p>
        )}
        <p className="subtitle">
          Gross estimates before costs and debts; prices vary. Multiple transactions may be needed.
        </p>
      </div>
      <NetworkBoard
        checks={applicableChecks}
        networks={applicableNetworks}
        finished={runs}
        addresses={wallets.map((wallet) => wallet.address)}
      />
      {multiWallet ? (
        <ProtocolReport wallets={wallets} runs={runs} checks={checks} />
      ) : (
        wallets.map((wallet) => (
          <WalletReport
            key={wallet.address}
            wallet={wallet}
            runs={runs.filter((run) => run.address === wallet.address)}
            checks={checks}
            networks={networks}
            collapsible={wallets.length > 1}
          />
        ))
      )}
      <p className="subtitle">
        DeFi Checkup is free and open source. If it helped you, you can{' '}
        <a href="/support">support it</a>.
      </p>
    </section>
  );
}
