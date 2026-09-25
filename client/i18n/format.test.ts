// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { barDates, dayDate, dayRange, formatDate, monthLabel, percent, shortDate, weekdayLetter } from './format';

const ARABIC_INDIC = /[٠-٩۰-۹]/;

describe('format, English (unchanged from before M6)', () => {
  it('formats a day', () => {
    expect(dayDate('en', '2026-10-12')).toBe('Mon 12 Oct');
    expect(formatDate('en', '2026-10-12')).toBe('Mon 12 Oct 2026');
    expect(shortDate('en', '2026-10-12')).toBe('12 Oct');
    expect(monthLabel('en', '2026-10-12')).toBe('Oct');
    expect(weekdayLetter('en', '2026-10-12')).toBe('M');
    expect(dayDate('en', '2026-03-01')).toBe('Sun 1 Mar');
  });

  it('formats ranges and percentages', () => {
    expect(barDates('en', '2026-09-08', '2026-09-19')).toBe('8 Sep – 19 Sep');
    expect(barDates('en', '2026-11-30', '2027-02-19')).toBe('30 Nov 2026 – 19 Feb 2027');
    expect(dayRange('en', '2026-10-12', '2026-10-16')).toBe('12–16 Oct');
    expect(dayRange('en', '2026-09-28', '2026-10-02')).toBe('28 Sep – 2 Oct');
    expect(dayRange('en', '2026-10-12', '2026-10-12')).toBe('12 Oct');
    expect(percent('en', 60)).toBe('60%');
  });
});

describe('format, Arabic', () => {
  it('formats a day with Arabic names and no comma', () => {
    expect(dayDate('ar', '2026-10-12')).toBe('الاثنين 12 أكتوبر');
    expect(formatDate('ar', '2026-10-12')).toBe('الاثنين 12 أكتوبر 2026');
    expect(shortDate('ar', '2026-10-12')).toBe('12 أكتوبر');
    expect(monthLabel('ar', '2026-10-12')).toBe('أكتوبر');
    expect(weekdayLetter('ar', '2026-10-12')).toBe('ن');
  });

  it('does not shift the date across time zones', () => {
    expect(dayDate('ar', '2026-01-01')).toBe('الخميس 1 يناير');
    expect(dayDate('ar', '2026-12-31')).toBe('الخميس 31 ديسمبر');
  });

  it('formats ranges, with the year only when the years differ', () => {
    expect(barDates('ar', '2026-09-08', '2026-09-19')).toBe('8 سبتمبر – 19 سبتمبر');
    const across = barDates('ar', '2026-11-30', '2027-02-19');
    expect(across).toContain('2026');
    expect(across).toContain('2027');
    expect(across).toBe('30 نوفمبر 2026 – 19 فبراير 2027');
    expect(dayRange('ar', '2026-10-12', '2026-10-16')).toBe('⁦12–16⁩ أكتوبر');
    expect(percent('ar', 60)).toBe('60%');
  });

  it('uses Western digits only', () => {
    const outputs = [
      dayDate('ar', '2026-10-12'),
      formatDate('ar', '2026-10-12'),
      shortDate('ar', '2026-10-12'),
      monthLabel('ar', '2026-10-12'),
      weekdayLetter('ar', '2026-10-12'),
      barDates('ar', '2026-11-30', '2027-02-19'),
      dayRange('ar', '2026-09-28', '2026-10-02'),
      percent('ar', 60),
    ];
    for (const s of outputs) expect(s).not.toMatch(ARABIC_INDIC);
  });

  it('keeps an Arabic day range like "14–18" left to right with an isolate, and English without one', () => {
    const ar = dayRange('ar', '2026-09-14', '2026-09-18');
    expect(ar).toBe('⁦14–18⁩ سبتمبر');
    expect(ar.indexOf('⁦')).toBe(0);
    expect(ar.indexOf('⁩')).toBe(6);
    // Month names already separate the numbers of a range across months, so it needs no isolate.
    expect(dayRange('ar', '2026-09-28', '2026-10-02')).toBe('28 سبتمبر – 2 أكتوبر');
    expect(barDates('ar', '2026-09-08', '2026-09-19')).not.toMatch(/[⁦-⁩]/);
    const en = [dayRange('en', '2026-09-14', '2026-09-18'), barDates('en', '2026-09-14', '2026-09-18'), dayRange('en', '2026-09-28', '2026-10-02')];
    expect(en).toEqual(['14–18 Sep', '14 Sep – 18 Sep', '28 Sep – 2 Oct']);
    for (const s of en) expect(s).not.toMatch(/[⁦-⁩]/);
  });
});
