import { describe, it, expect } from 'vitest';
import { toIsoWeek, fromIsoWeek, weekDates, minutesToTimeStr, timeStrToMinutes } from '@/lib/utils/date';

describe('ISO week utils', () => {
  it('toIsoWeek for 2026-04-18 returns 2026-W16', () => {
    expect(toIsoWeek(new Date('2026-04-18'))).toBe('2026-W16');
  });

  it('fromIsoWeek returns Monday of that week', () => {
    const monday = fromIsoWeek('2026-W16');
    expect(monday.toISOString().slice(0, 10)).toBe('2026-04-13');
  });

  it('weekDates returns 7 dates Mon~Sun', () => {
    const dates = weekDates('2026-W16');
    expect(dates.length).toBe(7);
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-04-13');
    expect(dates[6].toISOString().slice(0, 10)).toBe('2026-04-19');
  });
});

describe('time conversion', () => {
  it('minutesToTimeStr pads zeros', () => {
    expect(minutesToTimeStr(0)).toBe('00:00');
    expect(minutesToTimeStr(540)).toBe('09:00');
    expect(minutesToTimeStr(1439)).toBe('23:59');
  });

  it('timeStrToMinutes parses HH:mm', () => {
    expect(timeStrToMinutes('09:00')).toBe(540);
    expect(timeStrToMinutes('23:59')).toBe(1439);
  });
});

import { WEEKDAYS_KO } from '@/lib/utils/date';

describe('WEEKDAYS_KO', () => {
  it('starts with monday', () => {
    expect(WEEKDAYS_KO).toEqual(['월','화','수','목','금','토','일']);
  });
});
