import { describe, expect, it } from 'vitest';
import {
  closingSoon,
  deadlinesSoon,
  staleChecks,
  utcDay,
  utcToday,
  type DatedCheck,
} from './deadlines';

function fixture(id: string, deadline: string | null, verifiedOn = '2026-09-02'): DatedCheck {
  return { id, name: id, deadline, verifiedOn };
}

describe('UTC catalog dates', () => {
  it('accepts leap days and rejects normalized or non-calendar dates', () => {
    expect(utcDay('2028-02-29') - utcDay('2028-02-28')).toBe(1);
    for (const date of ['2026-02-29', '2026-11-31', '2026-1-01', '2026-11-01T12:00:00Z', 'invalid'])
      expect(() => utcDay(date)).toThrow('Invalid catalog date');
  });

  it('uses UTC at timezone boundaries and ignores DST changes', () => {
    expect(utcToday(new Date('2026-11-01T23:59:59-06:00'))).toBe('2026-11-02');
    expect(utcToday(new Date('2026-11-01T00:00:00+14:00'))).toBe('2026-10-31');
    expect(utcDay('2026-11-02') - utcDay('2026-10-31')).toBe(2);
  });

  it('includes today and exactly 30 days, excluding yesterday and day 31, with stable date order', () => {
    const checks = [
      fixture('day-31', '2026-12-02'),
      fixture('day-30', '2026-12-01'),
      fixture('today-b', '2026-11-01'),
      fixture('none', null),
      fixture('yesterday', '2026-10-31'),
      fixture('today-a', '2026-11-01'),
    ];
    expect(deadlinesSoon(checks, '2026-11-01').map(({ check, days }) => [check.id, days])).toEqual([
      ['today-a', 0],
      ['today-b', 0],
      ['day-30', 30],
    ]);
    expect(deadlinesSoon(checks, '2026-11-02').some(({ check }) => check.id === 'today-a')).toBe(
      false,
    );
  });

  it('shows all future deadlines and only the past 30 days of expiry, without inventing dates', () => {
    const checks = [
      fixture('old', '2026-10-01'),
      fixture('expired', '2026-10-02'),
      fixture('yesterday', '2026-10-31'),
      fixture('future', '2027-01-01'),
      fixture('none', null),
    ];
    const result = closingSoon(checks, '2026-11-01');
    expect(result.upcoming.map(({ check }) => check.id)).toEqual(['future']);
    expect(result.expired.map(({ check }) => check.id)).toEqual(['expired', 'yesterday']);
    expect(closingSoon([fixture('none', null)], '2026-11-01')).toEqual({
      upcoming: [],
      expired: [],
    });
  });

  it('flags only dates older than exactly 60 UTC calendar days', () => {
    const checks = [
      fixture('sixty-one', null, '2026-09-01'),
      fixture('sixty', null, '2026-09-02'),
      fixture('fifty-nine', null, '2026-09-03'),
    ];
    expect(staleChecks(checks, '2026-11-01').map(({ id }) => id)).toEqual(['sixty-one']);
    expect(staleChecks(checks, '2026-11-02').map(({ id }) => id)).toEqual(['sixty-one', 'sixty']);
  });
});
