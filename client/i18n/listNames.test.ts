// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Lists } from '../../shared/types';
import { listName, phaseName } from './listNames';

function lists(overrides: Partial<Lists> = {}): Lists {
  return {
    mainProject: [],
    projectType: [],
    goal: [],
    department: [],
    phase: [
      { id: 50, list: 'phase', name: 'Requirements gathering', order: 0, nameAr: 'جمع المتطلبات' },
      { id: 53, list: 'phase', name: 'Development', order: 3, nameAr: 'التطوير' },
      { id: 60, list: 'phase', name: 'Custom phase', order: 10, nameAr: null },
    ],
    role: [],
    attachmentType: [],
    company: [],
    personDocumentType: [],
    accountType: [],
    ...overrides,
  };
}

describe('listName', () => {
  it('returns the Arabic name in Arabic', () => {
    expect(listName({ name: 'Development', nameAr: 'التطوير' }, 'ar')).toBe('التطوير');
  });
  it('falls back to the English name in Arabic when there is no Arabic name', () => {
    expect(listName({ name: 'Custom phase', nameAr: null }, 'ar')).toBe('Custom phase');
  });
  it('always returns the English name in English, even when an Arabic name is set', () => {
    expect(listName({ name: 'Development', nameAr: 'التطوير' }, 'en')).toBe('Development');
  });
  it('returns an empty string for no value', () => {
    expect(listName(null, 'ar')).toBe('');
    expect(listName(undefined, 'en')).toBe('');
  });
});

describe('phaseName', () => {
  it('returns the stored text unchanged in English', () => {
    expect(phaseName('development', lists(), 'en')).toBe('development');
  });
  it('in Arabic, finds the Phases-list value ignoring case and returns its Arabic name', () => {
    expect(phaseName('development', lists(), 'ar')).toBe('التطوير');
    expect(phaseName('DEVELOPMENT', lists(), 'ar')).toBe('التطوير');
  });
  it('in Arabic, returns the stored text unchanged when nothing matches', () => {
    expect(phaseName('Data migration', lists(), 'ar')).toBe('Data migration');
  });
  it('in Arabic, falls back to the English name when the matching value has no Arabic name', () => {
    expect(phaseName('Custom phase', lists(), 'ar')).toBe('Custom phase');
  });
});
