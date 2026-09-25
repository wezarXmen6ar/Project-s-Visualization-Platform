import { ar } from './ar';
import { en, type MessageKey } from './en';
import type { Lang, Message, Params, ReasonParam } from './types';

const catalogues: Record<Lang, Record<MessageKey, Message>> = { ar, en };

const pluralRules: Record<Lang, Intl.PluralRules> = {
  ar: new Intl.PluralRules('ar'),
  en: new Intl.PluralRules('en'),
};

function isReasonParams(value: unknown): value is ReasonParam[] {
  return Array.isArray(value);
}

/** Whether `key` is one of the catalogue's own keys, e.g. to tell a schema's own message key from zod's built-in text. */
export function isMessageKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

/** One reason's own text, e.g. "they are assigned to 3 phases" / "مكلَّف في 3 مراحل". */
function reasonText(lang: Lang, r: ReasonParam): string {
  if (!isMessageKey(r.code)) return r.code;
  const message = catalogues[lang][r.code];
  return renderMessage(lang, message, { count: r.count });
}

/**
 * Joins a reasons list with the right conjunction for the language: "A and B" in English, "A وB" in Arabic (Arabic
 * repeats و between every pair rather than using commas).
 */
function joinReasons(lang: Lang, reasons: ReasonParam[]): string {
  const parts = reasons.map((r) => reasonText(lang, r));
  return lang === 'ar' ? parts.join(' و') : parts.join(' and ');
}

function fill(lang: Lang, text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in params)) return whole;
    const value = params[name];
    return isReasonParams(value) ? joinReasons(lang, value) : String(value);
  });
}

/**
 * Turns one message into text: picks the plural form for `params.count` (falling back to `other`), then fills in
 * the `{name}` placeholders.
 */
export function renderMessage(lang: Lang, message: Message, params?: Params): string {
  if (typeof message === 'string') return fill(lang, message, params);
  const form = pluralRules[lang].select(Number(params?.count ?? 0));
  return fill(lang, message[form] ?? message.other, params);
}

/** The text for `key` in `lang`. An unknown key comes back as the key itself, so nothing is ever blank. */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const message = catalogues[lang][key] as Message | undefined;
  return message === undefined ? key : renderMessage(lang, message, params);
}
