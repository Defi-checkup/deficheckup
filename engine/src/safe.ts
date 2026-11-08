// Builder's 5 requests/s, supplied by the staging investigation on 2026-11-02. Safe's quota
// docs describe account-wide enforcement: https://docs.safe.global/core-api/api-authentication.
export const SAFE_REQUESTS_PER_SECOND = 5;
export const SAFE_REQUEST_SPACING_MS = Math.ceil(1_000 / SAFE_REQUESTS_PER_SECOND) + 10;
export const SAFE_MAX_CONCURRENCY = 5;
// Leave time for the browser's 5 s API timeout and the engine's 10 s check timeout.
export const SAFE_PROXY_BUDGET_MS = 4_000;
export const SAFE_CHECK_BUDGET_MS = 9_000;

/** Bound queued work and response bodies too, not just the wait for response headers. */
export function safeWithin<T>(work: Promise<T>, deadline: number, late: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(late), Math.max(0, deadline - Date.now()));
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Only timing and in-flight promises live here. No address, key, response cache or logging. */
export function createSafePacer() {
  let nextStart = 0;
  let tail = Promise.resolve();
  const active = new Set<Promise<unknown>>();

  return async function pace<T>(
    work: () => Promise<T>,
    deadline: number,
    notBefore = 0,
  ): Promise<T | null> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await previous;
      while (active.size >= SAFE_MAX_CONCURRENCY && Date.now() < deadline) {
        await safeWithin(Promise.race(active), deadline, null);
      }
      const start = Math.max(nextStart, notBefore);
      if (Math.max(start, Date.now()) >= deadline) return null;
      if (start > Date.now()) {
        await new Promise((resolve) => setTimeout(resolve, start - Date.now()));
      }
      if (Date.now() >= deadline) return null;
      nextStart = Date.now() + SAFE_REQUEST_SPACING_MS;
      const result = work();
      // Rejections release the concurrency slot without creating an unhandled rejection.
      const settled = result.then(
        () => undefined,
        () => undefined,
      );
      active.add(settled);
      void settled.then(() => active.delete(settled));
      release();
      return await result;
    } finally {
      release();
    }
  };
}
