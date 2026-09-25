import type { Lang } from '../../shared/i18n/types';
import { useLang, useT } from './LanguageProvider';

const OPTIONS: { lang: Lang; key: 'lang.ar' | 'lang.en' }[] = [
  { lang: 'ar', key: 'lang.ar' },
  { lang: 'en', key: 'lang.en' },
];

/** Two buttons, "العربية" and "English", each written in its own language. */
export function LanguageSwitch() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.switch')}>
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          aria-pressed={lang === o.lang}
          onClick={() => setLang(o.lang)}
        >
          {t(o.key)}
        </button>
      ))}
    </div>
  );
}
