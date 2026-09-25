export type Lang = 'ar' | 'en';

/** A message that changes with a count. The forms are the ones `Intl.PluralRules` returns; `other` is the fallback. */
export interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralForms;

export type Params = Record<string, string | number>;
