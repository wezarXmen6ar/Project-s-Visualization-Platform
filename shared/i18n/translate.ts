import { ar } from './ar';
import { en, type MessageKey } from './en';
import type { Lang, Message, Params } from './types';

const catalogues: Record<Lang, Record<MessageKey, Message>> = { ar, en };

const pluralRules: Record<Lang, Intl.PluralRules> = {
  ar: new Intl.PluralRules('ar'),
  en: new Intl.PluralRules('en'),
};

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/**
 * Turns one message into text: picks the plural form for `params.count` (falling back to `other`), then fills in
 * the `{name}` placeholders.
 */
export function renderMessage(lang: Lang, message: Message, params?: Params): string {
  if (typeof message === 'string') return fill(message, params);
  const form = pluralRules[lang].select(Number(params?.count ?? 0));
  return fill(message[form] ?? message.other, params);
}

/** The text for `key` in `lang`. An unknown key comes back as the key itself, so nothing is ever blank. */
export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  const message = catalogues[lang][key] as Message | undefined;
  return message === undefined ? key : renderMessage(lang, message, params);
}
