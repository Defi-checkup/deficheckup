import { useEffect, useRef } from 'react';
import type { CheckOutcome, Network } from '@deficheckup/engine';
import type { CheckInfo } from '../lib/catalog';
import { networkNames } from '../lib/catalog';
import { networkCoverage } from '../lib/report';
import TokenCoin from './TokenCoin';

interface Finished {
  checkId: string;
  address: string;
  outcome: CheckOutcome;
}

export default function NetworkBoard({
  checks,
  networks,
  finished,
  address,
  addresses,
  scanning = false,
}: {
  checks: readonly CheckInfo[];
  networks: readonly Network[];
  finished: readonly Finished[];
  address?: string;
  addresses?: readonly string[];
  scanning?: boolean;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const current = finished.filter((run) =>
    addresses ? addresses.includes(run.address) : run.address === address,
  );
  const latest = current.at(-1);
  const latestCheck = checks.find((check) => check.id === latest?.checkId);
  const network =
    latest?.outcome.kind === 'found'
      ? latest.outcome.findings[0].network
      : (latestCheck?.networks[0] ?? networks[0]);

  useEffect(() => {
    const board = boardRef.current;
    const lens = lensRef.current;
    if (!board || !lens) return;
    function position() {
      if (!board || !lens) return;
      const tile = board.querySelector<HTMLElement>(`[data-network="${network}"]`);
      if (!tile) return;
      const frame = board.getBoundingClientRect();
      const rect = tile.getBoundingClientRect();
      const size = Math.max(88, Math.min(140, rect.width * 1.24));
      // Kept inside the board (size plus its 4px border): over a tile at the edge, a centered lens
      // would stick out and make the whole page scroll sideways while it passes there.
      const half = size / 2 + 4;
      const center = rect.left - frame.left + rect.width / 2;
      const left = Math.min(Math.max(center, half), Math.max(half, frame.width - half));
      // CSSOM properties keep measured geometry out of inline HTML styles under CSP.
      lens.style.setProperty('--lens-left', `${left}px`);
      lens.style.setProperty('--lens-top', `${rect.top - frame.top + rect.height / 2}px`);
      lens.style.setProperty('--lens-size', `${size}px`);
      lens.style.setProperty('--board-width', `${frame.width}px`);
      lens.classList.toggle('mirror-handle', rect.right >= frame.right - 1);
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(board);
    return () => observer.disconnect();
  }, [network, current.length, scanning]);

  function tiles(magnified = false) {
    return networks.map((network) => {
      const { findings, pending, status } = networkCoverage(
        network,
        checks,
        current,
        addresses ?? (address ? [address] : []),
        scanning,
      );
      return (
        <div
          className={`network-tile ${findings.length ? 'has-finding' : ''} ${pending ? 'is-scanning' : ''}`}
          key={network}
          data-network={magnified ? undefined : network}
        >
          {findings.length > 0 && (
            <div className="tile-coins" aria-hidden="true">
              {findings.slice(0, 3).map((finding, index) => (
                <TokenCoin symbol={finding.amount?.symbol ?? 'POS'} index={index} key={index} />
              ))}
            </div>
          )}
          <span>{networkNames[network]}</span>
          <span className="tile-status">
            {findings.length > 0 ? `${findings.length} found · ` : ''}
            {status}
          </span>
        </div>
      );
    });
  }
  return (
    <div className="network-frame" ref={boardRef}>
      <div className="network-board" role="group" aria-label="Network progress">
        {tiles()}
      </div>
      {scanning && (
        <div className="magnifier" ref={lensRef} aria-hidden="true">
          <div className="magnifier-glass">
            <div className="network-board magnified-board">{tiles(true)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
