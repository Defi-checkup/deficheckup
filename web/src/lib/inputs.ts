export const MAX_WALLETS = 10;

export function splitInputs(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((input) => input.trim())
        .filter(Boolean),
    ),
  ];
}
