export const TEST_SITE_KEY = '1x00000000000000000000AA';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export interface WidgetOptions {
  sitekey: string;
  action: 'scan';
  appearance: 'interaction-only';
  execution: 'execute';
  theme: 'dark';
  size: 'flexible';
  retry: 'never';
  'refresh-expired': 'never';
  'response-field': false;
  callback(token: string): void;
  'error-callback'(): void;
  'expired-callback'(): void;
  'timeout-callback'(): void;
  'unsupported-callback'(): void;
  'before-interactive-callback'(): void;
  'after-interactive-callback'(): void;
}
export interface Turnstile {
  render(container: HTMLElement, options: WidgetOptions): string;
  execute(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | undefined;
function load(): Promise<Turnstile> {
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(fail, 15_000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error('Verification script unavailable.'));
    }
    script.src = SCRIPT;
    script.async = true;
    script.onerror = fail;
    // An async script has already run when onload fires. Cloudflare throws if turnstile.ready()
    // is called on a script loaded with async or defer, so resolve directly.
    script.onload = () => {
      if (!window.turnstile) return fail();
      clearTimeout(timer);
      resolve(window.turnstile);
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/** Called once after input validation, immediately before the scan's first proxy request. */
export async function requestScanToken(
  container: HTMLElement,
  sitekey: string | undefined,
  onInteractionChange?: (interactive: boolean) => void,
) {
  if (!sitekey || /TO_SET|PLACEHOLDER/.test(sitekey)) throw new Error('Missing verification key.');
  const api = await load();
  let id: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  try {
    return await new Promise<string>((resolve, reject) => {
      const fail = () => reject(new Error('Verification unavailable.'));
      // Leave time for an accessible checkbox when Cloudflare requests interaction.
      timer = setTimeout(fail, 60_000);
      id = api.render(container, {
        sitekey,
        action: 'scan',
        appearance: 'interaction-only',
        execution: 'execute',
        theme: 'dark',
        size: 'flexible',
        retry: 'never',
        'refresh-expired': 'never',
        'response-field': false,
        callback: (token) => (token ? resolve(token) : fail()),
        'error-callback': fail,
        'expired-callback': fail,
        'timeout-callback': fail,
        'unsupported-callback': fail,
        'before-interactive-callback': () => {
          if (active) onInteractionChange?.(true);
        },
        'after-interactive-callback': () => {
          if (active) onInteractionChange?.(false);
        },
      });
      api.execute(id);
    });
  } finally {
    active = false;
    clearTimeout(timer);
    onInteractionChange?.(false);
    if (id !== undefined) api.remove(id);
  }
}
