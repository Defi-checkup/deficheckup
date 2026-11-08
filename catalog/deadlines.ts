import type { Check } from '@deficheckup/engine';

const DAY_MS = 86_400_000;
export type DatedCheck = Pick<Check, 'id' | 'name' | 'deadline' | 'verifiedOn'>;

/** Strict calendar dates only. All comparisons use UTC calendar days, including the last day. */
export function utcDay(date: string): number {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(ms) ||
    new Date(ms).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid catalog date: ${date}`);
  }
  return ms / DAY_MS;
}

export function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function deadlineEntries(checks: readonly DatedCheck[], today: string) {
  const day = utcDay(today);
  return checks
    .flatMap((check) =>
      check.deadline === null
        ? []
        : [
            {
              check,
              deadline: check.deadline,
              days: utcDay(check.deadline) - day,
            },
          ],
    )
    .sort((a, b) => a.days - b.days || a.check.id.localeCompare(b.check.id));
}

/** Today through day 30 inclusive. A date-only deadline remains open throughout its UTC day. */
export function deadlinesSoon(checks: readonly DatedCheck[], today: string) {
  return deadlineEntries(checks, today).filter(({ days }) => days >= 0 && days <= 30);
}

/** All upcoming deadlines and those expired during the last 30 UTC calendar days. */
export function closingSoon(checks: readonly DatedCheck[], today: string) {
  const entries = deadlineEntries(checks, today);
  return {
    upcoming: entries.filter(({ days }) => days >= 0),
    expired: entries.filter(({ days }) => days < 0 && days >= -30),
  };
}

/** Older than 60 days: exactly 60 UTC calendar days old is still current. */
export function staleChecks(checks: readonly DatedCheck[], today: string) {
  return checks.filter((check) => utcDay(today) - utcDay(check.verifiedOn) > 60);
}
