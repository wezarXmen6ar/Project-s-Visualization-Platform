import type { MessageKey } from '../shared/i18n/en';
import { translate } from '../shared/i18n/translate';
import type { Lang, Params } from '../shared/i18n/types';
import type { ValidationIssue } from '../shared/schemas';
import { ApiError } from './api';

/** `t(key, params)`, e.g. `useT()`. Given directly (not via the provider) so this file stays independent of React. */
export type Translator = (key: MessageKey, params?: Params) => string;

/** A plain `translate(lang, ...)` translator, for callers that have a `Lang` but no `useT()` (e.g. outside a component). */
export function translatorFor(lang: Lang): Translator {
  return (key, params) => translate(lang, key, params);
}

/** One issue or error's text: `t(code, params)` when there is a code, otherwise the server's own (English) message. */
export function messageFor(t: Translator, item: { message: string; code?: MessageKey; params?: Params }): string {
  return item.code ? t(item.code, item.params) : item.message;
}

/**
 * The server's field messages when there are any, otherwise the error's own message — each translated with `t` when
 * it carries a `code`, and falling back to the server's English text otherwise (an unknown error, or one with no
 * code). Without a `t` (the default), everything stays English, so existing callers keep working unchanged.
 */
export function messagesOf(err: unknown, t: Translator = translatorFor('en')): string[] {
  if (err instanceof ApiError && err.issues.length > 0) return err.issues.map((i) => messageFor(t, i));
  if (err instanceof ApiError) return [messageFor(t, { message: err.message, code: err.code, params: err.params })];
  // The request never reached the server at all (fetch itself threw, e.g. offline): its message (like "Failed to
  // fetch") is a browser-specific string, not one of ours, so it's never shown; this translated one always is.
  return [t('common.networkError')];
}

/** One `ValidationIssue`'s text, translated when it carries a `code`. */
export function issueMessage(t: Translator, issue: ValidationIssue): string {
  return messageFor(t, issue);
}
