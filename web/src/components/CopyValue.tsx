import { useState } from 'react';

export default function CopyValue({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState('');
  const [copying, setCopying] = useState(false);

  async function copy() {
    if (copying) return;
    setStatus('');
    setCopying(true);
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied');
    } catch {
      setStatus('Could not copy. Select and copy the full value.');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="stack">
      <p className="mono address">{value}</p>
      <div>
        <button className="secondary" type="button" onClick={copy} aria-busy={copying}>
          Copy {label}
        </button>{' '}
        <span className="subtitle" role="status" aria-live="polite" aria-atomic="true">
          {status}
        </span>
      </div>
    </div>
  );
}
