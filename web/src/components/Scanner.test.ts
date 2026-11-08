import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import type * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ETHEREUM_TOKENS } from '../../../catalog/shared/tokens';
import type { requestScanToken } from '../lib/turnstile';
import Scanner from './Scanner';

// Exercise the form and async submit without a browser, network or downloaded report code.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  effects: [] as { deps?: readonly unknown[]; cleanup?: void | (() => void) }[],
  pendingEffects: [] as (() => void)[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++;
    return (hooks.refs[index] ??= { current: initial });
  },
  useEffect: (setup: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = hooks.effectIndex++;
    const previous = hooks.effects[index];
    if (previous && deps && previous.deps?.every((value, i) => Object.is(value, deps[i]))) return;
    const effect = { deps } as (typeof hooks.effects)[number];
    hooks.effects[index] = effect;
    hooks.pendingEffects.push(() => {
      previous?.cleanup?.();
      effect.cleanup = setup();
    });
  },
}));
const runtime = vi.hoisted(() => ({
  createCheckContext: vi.fn(() => ({})),
  createEnsResolver: vi.fn(() => ({})),
  resolveInputs: vi.fn(async (inputs: string[]) => ({
    wallets: inputs.map((address) => ({ input: address, address })),
    invalid: [],
  })),
  runChecks: vi.fn(async () => ({ runs: [] })),
  createProxySession: vi.fn((options: { token: () => Promise<string> }) => ({
    authorize: vi.fn(async () => {
      await options.token();
    }),
    fetch: vi.fn(),
  })),
  requestScanToken: vi.fn<typeof requestScanToken>(async () => 'XXXX.DUMMY.TOKEN.XXXX'),
  TEST_SITE_KEY: '1x00000000000000000000AA',
  checks: [],
}));
const loadStyles = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../lib/scan', () => runtime);
vi.mock('./ScanViews', () => ({ loadStyles }));

const addresses = [
  '0x000000000000000000000000000000000000dEaD',
  ...ETHEREUM_TOKENS.map((token) => token.address),
].slice(0, 11);

function render() {
  hooks.stateIndex = hooks.refIndex = hooks.effectIndex = 0;
  const tree = Scanner({ checks: [], networks: [] });
  for (const effect of hooks.pendingEffects.splice(0)) effect();
  return tree;
}
function descendants(node: ReactNode): ReactElement[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child)
      ? [child, ...descendants(child.props.children)]
      : [],
  );
}
function element<T extends 'form' | 'textarea'>(tree: ReactNode, type: T) {
  return descendants(tree).find((child) => child.type === type) as ReactElement<ComponentProps<T>>;
}
function enter(value: string) {
  const input = element(render(), 'textarea');
  input.props.onChange!({ target: { value } } as Parameters<
    NonNullable<typeof input.props.onChange>
  >[0]);
  return render();
}
function submit(tree: ReactNode) {
  const form = element(tree, 'form');
  const preventDefault = vi.fn();
  form.props.onSubmit!({ preventDefault } as unknown as Parameters<
    NonNullable<typeof form.props.onSubmit>
  >[0]);
  expect(preventDefault).toHaveBeenCalledOnce();
}
function noScan() {
  expect(loadStyles).not.toHaveBeenCalled();
  expect(runtime.createEnsResolver).not.toHaveBeenCalled();
  expect(runtime.resolveInputs).not.toHaveBeenCalled();
  expect(runtime.createCheckContext).not.toHaveBeenCalled();
  expect(runtime.createProxySession).not.toHaveBeenCalled();
  expect(runtime.runChecks).not.toHaveBeenCalled();
}

beforeEach(() => {
  hooks.values = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.pendingEffects = [];
  vi.clearAllMocks();
});

afterEach(() => {
  for (const effect of hooks.effects) effect.cleanup?.();
  vi.unstubAllGlobals();
});

describe('scanner wallet limit and nonblocking warning', () => {
  it('shows the warning politely only for multiple distinct inputs, keeping the privacy link', () => {
    for (const [value, visible] of [
      ['', false],
      [addresses[0]!, false],
      [`${addresses[0]}, ${addresses[0]}`, false],
      [addresses.slice(0, 2).join('\n'), true],
      [addresses[0]!, false],
    ] as const) {
      const tree = enter(value);
      const warning = descendants(tree).find(
        (child) => (child.props as { id?: string }).id === 'multi-wallet-warning',
      )!;
      expect(warning.props).toMatchObject({ 'aria-live': 'polite', 'aria-atomic': 'true' });
      expect(warning.props).not.toHaveProperty('tabIndex');
      const text = renderToStaticMarkup(warning);
      expect(text.includes('Scanning several wallets can link them together.')).toBe(visible);
      expect(text.includes('Scanning one wallet at a time avoids this grouping.')).toBe(visible);
      const html = renderToStaticMarkup(tree);
      expect(html).toContain('Up to 10 EVM or Solana addresses');
      expect(html).toContain('<a href="/privacy">Who sees your scan?</a>');
      expect(html).not.toContain('type="checkbox"');
      noScan();
    }
  });

  it.each([1, 2, 10])(
    'starts %i wallets on the first submit, with no work before submit',
    async (count) => {
      const inputs = addresses.slice(0, count);
      const tree = enter(inputs.join('\n'));
      noScan();
      submit(tree);
      await vi.waitFor(() => expect(runtime.runChecks).toHaveBeenCalledTimes(count));
      expect(loadStyles).toHaveBeenCalledOnce();
      expect(runtime.resolveInputs).toHaveBeenCalledWith(inputs, {});
      expect(runtime.createProxySession).toHaveBeenCalledOnce();
      const session = runtime.createProxySession.mock.results[0]!.value;
      expect(session.authorize).toHaveBeenCalledOnce();
      expect(session.authorize.mock.invocationCallOrder[0]).toBeLessThan(
        runtime.runChecks.mock.invocationCallOrder[0]!,
      );
      expect(runtime.createCheckContext).toHaveBeenCalledWith({
        // The deploy script builds and tests with PUBLIC_PROXY_URL set; plain runs leave it unset.
        proxyUrl: import.meta.env.PUBLIC_PROXY_URL,
        fetchFn: session.fetch,
      });
      expect(runtime.runChecks.mock.calls.map((call) => (call as unknown[])[1])).toEqual(
        inputs.map((address) => [address]),
      );
    },
  );

  it.each([
    ['', 'Paste at least one wallet address or ENS name.'],
    [addresses.join('\n'), 'Please scan up to 10 addresses or ENS names at a time.'],
  ])(
    'rejects invalid input counts before loading or resolving anything',
    async (value, message) => {
      const tree = enter(value);
      const focus = vi.fn();
      hooks.refs[0]!.current = { focus };
      submit(tree);
      await Promise.resolve();
      noScan();
      expect(focus).toHaveBeenCalledOnce();
      expect(element(render(), 'textarea').props).toMatchObject({
        'aria-invalid': true,
        'aria-describedby': 'input-help scan-error',
      });
      expect(renderToStaticMarkup(render())).toContain(message);
    },
  );
});

describe('interactive browser verification', () => {
  const prompt = "Cloudflare needs one click to confirm you're human.";
  const verification = (tree: ReactNode) =>
    descendants(tree).find(
      (child) => (child.props as ComponentProps<'div'>)['aria-label'] === 'Browser verification',
    ) as ReactElement<ComponentProps<'div'>>;

  it.each([false, true])(
    'shows and announces interaction with reduced motion %s',
    async (reduced) => {
      const matchMedia = vi.fn(() => ({ matches: reduced }));
      vi.stubGlobal('window', { matchMedia });
      let changeInteraction: (interactive: boolean) => void = () => {};
      let complete: () => void = () => {};
      const token = new Promise<string>((resolve) => {
        complete = () => resolve('XXXX.DUMMY.TOKEN.XXXX');
      });
      runtime.requestScanToken.mockImplementationOnce(async (_container, _sitekey, changed) => {
        changeInteraction = changed!;
        return token.finally(() => changed?.(false));
      });
      const initial = enter(addresses[0]!);
      expect(verification(initial).props.hidden).toBe(true);
      const scrollIntoView = vi.fn();
      (verification(initial).props.ref as { current: unknown }).current = { scrollIntoView };
      const fields = Children.toArray(element(initial, 'form').props.children) as ReactElement<
        ComponentProps<'div'>
      >[];
      expect(fields[1]!.props.className).toBe('address-input');
      expect(fields[2]!.props['aria-label']).toBe('Browser verification');
      expect(fields[3]!.props.id).toBe('input-help');
      submit(initial);
      await vi.waitFor(() => expect(runtime.requestScanToken).toHaveBeenCalledOnce());
      expect(verification(render()).props.hidden).toBe(true);
      expect(scrollIntoView).not.toHaveBeenCalled();
      changeInteraction(true);
      render();
      const interactive = render();
      expect(verification(interactive).props.hidden).toBe(false);
      expect(renderToStaticMarkup(verification(interactive))).toContain(
        prompt.replace("'", '&#x27;'),
      );
      const status = descendants(interactive).find(
        (child) => (child.props as ComponentProps<'p'>).role === 'status',
      )!;
      expect(status.props).toMatchObject({ children: prompt, 'aria-atomic': 'true' });
      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        block: 'nearest',
        behavior: reduced ? 'instant' : 'smooth',
      });
      expect(runtime.runChecks).not.toHaveBeenCalled();
      changeInteraction(false);
      render();
      const after = render();
      expect(verification(after).props.hidden).toBe(true);
      expect(
        descendants(after).find((child) => (child.props as ComponentProps<'p'>).role === 'status')!
          .props,
      ).toMatchObject({ children: 'Verifying your browser before checking protocols.' });
      changeInteraction(true);
      render();
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      complete();
      await vi.waitFor(() => expect(runtime.runChecks).toHaveBeenCalledOnce());
      expect(verification(render()).props.hidden).toBe(true);
    },
  );
});
