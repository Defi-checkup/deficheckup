import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
type RGB = [number, number, number];
function color(token: string): RGB {
  const hex = css.match(new RegExp(`--${token}: #([a-f0-9]{6});`))?.[1];
  if (!hex) throw new Error(`Missing color: ${token}`);
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)) as RGB;
}
function luminance(rgb: RGB): number {
  return rgb.reduce((sum, channel, index) => {
    const value = channel / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
  }, 0);
}
function contrast(a: RGB, b: RGB): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
const surfaceNames = ['bg', 'panel', 'glow'];

describe('WCAG 2.2 AA palette audit', () => {
  it('keeps all small text and links above 4.5 on their opaque surfaces', () => {
    for (const background of surfaceNames) {
      for (const foreground of ['ink', 'soft', 'blue']) {
        expect(
          contrast(color(foreground), color(background)),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Faint text is used only on opaque panel inputs and waiting tiles, never on the glow.
    expect(contrast(color('faint'), color('panel'))).toBeCloseTo(5.048, 3);
  });
  it('keeps text readable on found tiles, including the brightest possible gradient underneath', () => {
    const wash = css.match(/--found-wash: rgba\(255, 184, 77, ([\d.]+)\)/)?.[1];
    if (!wash) throw new Error('Missing found wash.');
    for (const background of surfaceNames) {
      const composite = color(background).map(
        (channel, index) =>
          channel * (1 - Number(wash)) + color('coin-amber')[index]! * Number(wash),
      ) as RGB;
      for (const foreground of ['ink', 'soft']) {
        expect(
          contrast(color(foreground), composite),
          `${foreground} on wash over ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('keeps card text above 4.5 throughout the surface arrival fade', () => {
    for (const background of surfaceNames) {
      for (let frame = 0; frame <= 100; frame++) {
        const alpha = 0.28 + (1 - 0.28) * (frame / 100);
        const composite = color(background).map(
          (channel, index) => channel * (1 - alpha) + color('panel')[index]! * alpha,
        ) as RGB;
        for (const foreground of ['ink', 'soft', 'blue']) {
          expect(contrast(color(foreground), composite)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it('keeps control boundaries, check marks and focus above 3, and coin text above 4.5', () => {
    for (const surface of surfaceNames) {
      expect(contrast(color('soft'), color(surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(color('blue'), color(surface))).toBeGreaterThanOrEqual(3);
    }
    for (const coin of ['coin-amber', 'coin-blue', 'coin-pink', 'coin-mint']) {
      expect(contrast(color('bg'), color(coin))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
