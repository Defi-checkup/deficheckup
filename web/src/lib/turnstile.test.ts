import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Turnstile, WidgetOptions } from './turnstile';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

function browser(behavior: 'pass' | 'error' | 'blocked' | 'timeout' = 'pass') {
  let options: WidgetOptions;
  const script = { remove: vi.fn(), onload: () => {}, onerror: () => {}, src: '', async: false };
  const api: Turnstile = {
    render: vi.fn((_container, value) => {
      options = value;
      return 'widget';
    }),
    execute: vi.fn(() => {
      queueMicrotask(() => {
        if (behavior === 'pass') options.callback('XXXX.DUMMY.TOKEN.XXXX');
        if (behavior === 'error') options['error-callback']();
      });
    }),
    remove: vi.fn(),
  };
  const append = vi.fn(() =>
    queueMicrotask(() => (behavior === 'blocked' ? script.onerror() : script.onload())),
  );
  vi.stubGlobal('document', { createElement: () => script, head: { append } });
  vi.stubGlobal('window', { turnstile: api });
  return { api, script, append, options: () => options };
}

describe('explicit Turnstile client', () => {
  it('loads only on demand, reuses the script, executes one widget per scan and removes it', async () => {
    const { api, script, append } = browser();
    const { requestScanToken, TEST_SITE_KEY } = await import('./turnstile');
    expect(append).not.toHaveBeenCalled();
    for (let scan = 0; scan < 2; scan++) {
      expect(await requestScanToken({} as HTMLElement, TEST_SITE_KEY)).toBe(
        'XXXX.DUMMY.TOKEN.XXXX',
      );
    }
    expect(script.src).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    );
    expect(append).toHaveBeenCalledTimes(1);
    expect(api.render).toHaveBeenCalledTimes(2);
    expect(api.execute).toHaveBeenCalledTimes(2);
    expect(api.remove).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.render).mock.calls[0]![1]).toMatchObject({
      action: 'scan',
      appearance: 'interaction-only',
      execution: 'execute',
      retry: 'never',
      'response-field': false,
      theme: 'dark',
      size: 'flexible',
    });
  });

  it.each(['error', 'blocked', 'timeout'] as const)(
    'rejects %s without an alternate bypass',
    async (behavior) => {
      vi.useFakeTimers();
      const { api } = browser(behavior);
      const { requestScanToken, TEST_SITE_KEY } = await import('./turnstile');
      const result = requestScanToken({} as HTMLElement, TEST_SITE_KEY);
      const rejection = expect(result).rejects.toThrow(/Verification/);
      await vi.advanceTimersByTimeAsync(60_000);
      await rejection;
      expect(api.remove).toHaveBeenCalledTimes(behavior === 'blocked' ? 0 : 1);
    },
  );

  it('reports entering and leaving interaction, clears on success and ignores removed widgets', async () => {
    const { api, options } = browser('timeout');
    const { requestScanToken, TEST_SITE_KEY } = await import('./turnstile');
    const changed = vi.fn();
    const result = requestScanToken({} as HTMLElement, TEST_SITE_KEY, changed);
    await vi.waitFor(() => expect(api.execute).toHaveBeenCalledOnce());
    expect(changed).not.toHaveBeenCalled();
    options()['before-interactive-callback']();
    expect(changed).toHaveBeenLastCalledWith(true);
    options()['after-interactive-callback']();
    expect(changed).toHaveBeenLastCalledWith(false);
    options()['before-interactive-callback']();
    options().callback('XXXX.DUMMY.TOKEN.XXXX');
    await expect(result).resolves.toBe('XXXX.DUMMY.TOKEN.XXXX');
    expect(changed).toHaveBeenLastCalledWith(false);
    expect(api.remove).toHaveBeenCalledOnce();
    const count = changed.mock.calls.length;
    options()['before-interactive-callback']();
    options()['after-interactive-callback']();
    expect(changed).toHaveBeenCalledTimes(count);
  });

  it.each([
    'error-callback',
    'expired-callback',
    'timeout-callback',
    'unsupported-callback',
    'deadline',
  ] as const)('clears the interaction prompt on %s', async (failure) => {
    vi.useFakeTimers();
    const { api, options } = browser('timeout');
    const { requestScanToken, TEST_SITE_KEY } = await import('./turnstile');
    const changed = vi.fn();
    const result = requestScanToken({} as HTMLElement, TEST_SITE_KEY, changed);
    const rejection = expect(result).rejects.toThrow(/Verification/);
    await vi.advanceTimersByTimeAsync(0);
    options()['before-interactive-callback']();
    expect(changed).toHaveBeenLastCalledWith(true);
    if (failure === 'deadline') await vi.advanceTimersByTimeAsync(60_000);
    else options()[failure]();
    await rejection;
    expect(changed).toHaveBeenLastCalledWith(false);
    expect(api.remove).toHaveBeenCalledOnce();
  });
});
