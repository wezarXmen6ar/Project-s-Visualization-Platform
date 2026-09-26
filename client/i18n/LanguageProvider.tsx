import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MessageKey } from '../../shared/i18n/en';
import { translate } from '../../shared/i18n/translate';
import type { Lang, Params } from '../../shared/i18n/types';

const STORAGE_KEY = 'pvp.lang';

interface LangContext {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang(l: Lang): void;
}

/** Without a provider everything is English and left to right, so components rendered on their own stay English. */
const Context = createContext<LangContext>({ lang: 'en', dir: 'ltr', setLang: () => {} });

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

function store(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

/**
 * The app's language. With `lang` it is controlled (tests use this): that language is used, nothing is read from or
 * written to storage, and `<html>` is left alone. Without it, it starts from `localStorage['pvp.lang']` (Arabic when
 * nothing is stored), remembers each change, and keeps `<html lang dir>` in step while mounted.
 */
export function LanguageProvider(props: { lang?: Lang; children: ReactNode }) {
  const controlled = props.lang;
  const [chosen, setChosen] = useState<Lang>(() => controlled ?? readStored());
  const lang = controlled ?? chosen;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const setLang = useCallback(
    (l: Lang) => {
      if (controlled !== undefined) return;
      setChosen(l);
      store(l);
    },
    [controlled],
  );

  const isControlled = controlled !== undefined;

  // Put <html> and the tab title back as they were when the provider goes away, so nothing leaks between tests.
  useEffect(() => {
    if (isControlled) return;
    const root = document.documentElement;
    const before = { lang: root.getAttribute('lang'), dir: root.getAttribute('dir') };
    const beforeTitle = document.title;
    return () => {
      for (const name of ['lang', 'dir'] as const) {
        const value = before[name];
        if (value === null) root.removeAttribute(name);
        else root.setAttribute(name, value);
      }
      document.title = beforeTitle;
    };
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = translate(lang, 'app.title');
  }, [isControlled, lang, dir]);

  const value = useMemo(() => ({ lang, dir, setLang }) satisfies LangContext, [lang, dir, setLang]);
  return <Context.Provider value={value}>{props.children}</Context.Provider>;
}

export function useLang(): LangContext {
  return useContext(Context);
}

/** `t(key, params)` in the current language. */
export function useT(): (key: MessageKey, params?: Params) => string {
  const { lang } = useLang();
  return useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);
}
