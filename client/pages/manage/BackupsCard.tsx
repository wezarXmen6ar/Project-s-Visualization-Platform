import { api } from '../../api';
import { formatDate } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { useAsync } from '../../useAsync';

/** Shows when the last daily database backup was taken, and how many are kept. */
export function BackupsCard() {
  const t = useT();
  const { lang } = useLang();
  const backups = useAsync(() => api.getBackupStatus(), []);
  if (!backups.data) return null;
  const { latest, count } = backups.data;

  return (
    <section className="card">
      <h2>{t('backups.title')}</h2>
      {latest === null ? (
        <p className="meta-line">{t('backups.none')}</p>
      ) : (
        <p className="meta-line">{t('backups.last', { date: formatDate(lang, latest), count })}</p>
      )}
    </section>
  );
}
