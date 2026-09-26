import { describe, expect, it } from 'vitest';
import type { MessageKey } from './en';
import { renderMessage, translate } from './translate';
import type { Message } from './types';

const tasks: Message = { zero: 'لا مهام', one: 'مهمة واحدة', two: 'مهمتان', few: '{count} مهام', many: '{count} مهمة', other: '{count} مهمة' };

describe('renderMessage', () => {
  it('fills in placeholders', () => {
    expect(renderMessage('en', 'Hello {name}, you have {n} left', { name: 'Sara', n: 3 })).toBe('Hello Sara, you have 3 left');
    expect(renderMessage('ar', 'مرحباً {name}', { name: 'سارة' })).toBe('مرحباً سارة');
  });

  it('leaves a placeholder with no value as it is', () => {
    expect(renderMessage('en', 'Hi {name}')).toBe('Hi {name}');
  });

  it('picks the Arabic plural form for each count', () => {
    expect(renderMessage('ar', tasks, { count: 0 })).toBe('لا مهام');
    expect(renderMessage('ar', tasks, { count: 1 })).toBe('مهمة واحدة');
    expect(renderMessage('ar', tasks, { count: 2 })).toBe('مهمتان');
    expect(renderMessage('ar', tasks, { count: 3 })).toBe('3 مهام');
    expect(renderMessage('ar', tasks, { count: 11 })).toBe('11 مهمة');
    expect(renderMessage('ar', tasks, { count: 100 })).toBe('100 مهمة');
  });

  it('falls back to "other" when a form is missing', () => {
    expect(renderMessage('ar', { one: 'يوم واحد', other: '{count} يوم' }, { count: 2 })).toBe('2 يوم');
  });

  it('picks the English one and other forms', () => {
    const days: Message = { one: '{count} working day', other: '{count} working days' };
    expect(renderMessage('en', days, { count: 1 })).toBe('1 working day');
    expect(renderMessage('en', days, { count: 0 })).toBe('0 working days');
    expect(renderMessage('en', days, { count: 15 })).toBe('15 working days');
  });
});

describe('translate', () => {
  it('reads the catalogue of the language', () => {
    expect(translate('en', 'landing.manage')).toBe('Project Management');
    expect(translate('ar', 'landing.manage')).toBe('إدارة المشاريع');
  });

  it('returns the key itself for an unknown key', () => {
    expect(translate('ar', 'no.such.key' as MessageKey)).toBe('no.such.key');
    expect(translate('en', 'no.such.key' as MessageKey)).toBe('no.such.key');
  });

  it('wraps the Arabic UAE-mobile example in bidi isolates, so it renders in the right order', () => {
    const ar = translate('ar', 'validation.uaeMobile');
    expect(ar).toContain('⁦+971 50 123 4567⁩');
    expect(translate('en', 'validation.uaeMobile')).toBe('Enter a UAE mobile number, e.g. +971 50 123 4567');
  });
});
