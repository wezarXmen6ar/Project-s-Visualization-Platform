import type { PhaseNameParts, Ref } from '../shared/types';

/**
 * The phase-name SQL, shared by any query that joins a row to its (optional) phase: the joined "Phase › Sub-phase"
 * name, the top-level phase's own name, and a sub-phase's own name (or NULL). Assumes the query already joins
 * `phases p ON p.id = <table>.phase_id` and aliases it `p`; append `PHASE_JOIN_SQL` to also join the parent phase.
 */
export const PHASE_NAME_COLUMNS_SQL = `
    CASE WHEN parent.id IS NULL THEN p.name ELSE parent.name || ' › ' || p.name END AS phase_name,
    COALESCE(parent.name, p.name) AS phase_top_name,
    CASE WHEN parent.id IS NULL THEN NULL ELSE p.name END AS phase_sub_name`;

/** The parent-phase join `PHASE_NAME_COLUMNS_SQL` relies on; append after the query's own `LEFT JOIN phases p ...`. */
export const PHASE_JOIN_SQL = 'LEFT JOIN phases parent ON parent.id = p.parent_id';

/** A row carrying a phase id and the three `PHASE_NAME_COLUMNS_SQL` columns. */
export interface PhaseRefRow {
  phase_id: number | null;
  phase_name: string | null;
  phase_top_name: string | null;
  phase_sub_name: string | null;
}

/** Maps a row's phase columns to the `(Ref & PhaseNameParts) | null` shape used on `ToDoRecord` and `EntryRecord`. */
export function phaseRefFromRow(row: PhaseRefRow): (Ref & PhaseNameParts) | null {
  return row.phase_id === null
    ? null
    : { id: row.phase_id, name: row.phase_name!, phaseName: row.phase_top_name!, subPhaseName: row.phase_sub_name };
}
