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

/**
 * One reason in a multi-part "can't be deleted because…" message: `code` is another message key (its own plural
 * forms take `count`), and `count` is the number that goes with it. Sent over the wire so the client can render and
 * join each reason in its own language, instead of receiving pre-joined English text.
 */
export interface ReasonParam {
  code: string;
  count: number;
}

export type Params = Record<string, string | number | ReasonParam[]>;
