/** English count wording: zero takes the plural too. */
export function plural(count: number, singular: string, multiple = `${singular}s`): string {
  return count === 1 ? singular : multiple;
}
