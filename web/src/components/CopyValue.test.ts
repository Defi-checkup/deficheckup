import { Children, type ComponentProps, type ReactElement } from 'react';
import type * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyValue from './CopyValue';

// Exercise the same component handlers and state as the island, entirely offline.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => (hooks.values[index] = value)];
  },
}));

const value = 'example.eth';
function render() {
  hooks.index = 0;
  const tree = CopyValue({ value, label: 'ENS' });
  const row = Children.toArray(tree.props.children)[1] as ReactElement<{
    children: ReactElement[];
  }>;
  const children = Children.toArray(row.props.children);
  return {
    tree,
    button: children[0] as ReactElement<ComponentProps<'button'>>,
    status: children[2] as ReactElement<ComponentProps<'span'>>,
  };
}
function click() {
  const copy = render().button.props.onClick as () => Promise<void>;
  return copy();
}

beforeEach(() => {
  hooks.values = [];
});
afterEach(() => vi.unstubAllGlobals());

describe('copy value island', () => {
  it('renders the selectable full value and a persistent, initially empty polite status', () => {
    const { tree, button, status } = render();
    expect(renderToStaticMarkup(tree)).toContain('<p class="mono address">example.eth</p>');
    expect(renderToStaticMarkup(button)).toContain('Copy ENS');
    expect(button.props).toMatchObject({ type: 'button', 'aria-busy': false });
    expect(status.props).toMatchObject({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      children: '',
    });
  });

  it('writes only the full value and confirms only after the clipboard accepts it', async () => {
    let accept = () => {};
    const writeText = vi.fn(() => new Promise<void>((resolve) => (accept = resolve)));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const pending = click();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(value);
    expect(render().status.props.children).toBe('');
    expect(render().button.props['aria-busy']).toBe(true);
    // Keep the button focusable while a write is pending and ignore repeat activation.
    expect(render().button.props.disabled).toBeUndefined();
    await click();
    expect(writeText).toHaveBeenCalledOnce();
    accept();
    await pending;
    expect(render().status.props.children).toBe('Copied');
    expect(render().button.props['aria-busy']).toBe(false);
  });

  it('clears the previous announcement before another copy', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await click();
    expect(render().status.props.children).toBe('Copied');
    const repeated = click();
    expect(render().status.props.children).toBe('');
    await repeated;
    expect(render().status.props.children).toBe('Copied');
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it.each(['rejected', 'missing'])(
    'offers manual copying when the clipboard is %s',
    async (mode) => {
      const writeText = vi.fn(async () => {
        throw new Error('Clipboard unavailable');
      });
      vi.stubGlobal('navigator', mode === 'missing' ? {} : { clipboard: { writeText } });
      await click();
      expect(render().status.props.children).toBe(
        'Could not copy. Select and copy the full value.',
      );
      expect(render().button.props['aria-busy']).toBe(false);
      expect(renderToStaticMarkup(render().tree)).toContain(value);
      // A later user activation can recover without reloading the page.
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => {}) } });
      await click();
      expect(render().status.props.children).toBe('Copied');
    },
  );
});
