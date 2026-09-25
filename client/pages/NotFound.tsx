import { Link } from 'react-router';
import { useT } from '../i18n/LanguageProvider';

export function NotFound() {
  const t = useT();
  return (
    <main className="page">
      <h1>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.body')}</p>
      <Link to="/" className="button secondary">{t('notFound.back')}</Link>
    </main>
  );
}
