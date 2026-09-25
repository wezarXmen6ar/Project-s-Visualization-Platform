import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { formatDate } from './labels';

/** Shows when the last daily database backup was taken, and how many are kept. */
export function BackupsCard() {
  const backups = useAsync(() => api.getBackupStatus(), []);
  if (!backups.data) return null;
  const { latest, count } = backups.data;

  return (
    <section className="card">
      <h2>Backups</h2>
      {latest === null ? (
        <p className="meta-line">No backup yet. One is taken each day while the app is running.</p>
      ) : (
        <p className="meta-line">
          Last backup: {formatDate(latest)} · {count} kept in the backups folder.
        </p>
      )}
    </section>
  );
}
