import type { DatabaseSync } from 'node:sqlite';
import type { ISODate } from '../../shared/calendar';
import type { ExpiringItem } from '../../shared/types';
import { listExpiringAccounts } from './accounts';
import { listExpiringDocuments } from './documents';

const STATE_RANK: Record<ExpiringItem['state'], number> = { expired: 0, soon: 1, fine: 2 };

/** Documents and accounts together, for GET /api/people/expiring: expired first, then soonest first. */
export function listExpiring(db: DatabaseSync, today: ISODate, withinDays: number): ExpiringItem[] {
  const items = [...listExpiringDocuments(db, today, withinDays), ...listExpiringAccounts(db, today)];
  return items.sort(
    (a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.expiryDate.localeCompare(b.expiryDate) || a.id - b.id,
  );
}
