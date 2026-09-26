import type { EntryInput } from '../shared/schemas';
import type { EntryRecord, ProjectRecord, ResourceRecord } from '../shared/types';

export interface AttendeeChoices {
  /** The project's PMs and the people assigned to it, by name. */
  onProject: ResourceRecord[];
  /** Everyone else in Resources, by name. */
  others: ResourceRecord[];
}

/**
 * Who a meeting's attendees can be chosen from: everyone in Resources (active or not, either side), split into the
 * project's own people (its PMs and whoever is assigned to one of its phases) shown first, then everyone else.
 */
export function attendeeChoices(project: ProjectRecord, people: ResourceRecord[]): AttendeeChoices {
  const onProjectIds = new Set<number>();
  if (project.projectManager) onProjectIds.add(project.projectManager.id);
  if (project.businessPm) onProjectIds.add(project.businessPm.id);
  for (const a of project.assignments) onProjectIds.add(a.resource.id);

  const onProject: ResourceRecord[] = [];
  const others: ResourceRecord[] = [];
  for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
    (onProjectIds.has(p.id) ? onProject : others).push(p);
  }
  return { onProject, others };
}

/** The entry's saved fields as an `EntryInput`, for the Edit form (follow-ups are create-only, so always empty). */
export function entryToInput(e: EntryRecord): EntryInput {
  return {
    type: e.type,
    effectiveDate: e.effectiveDate,
    title: e.title,
    body: e.body,
    phaseId: e.phase?.id ?? null,
    highlight: e.highlight,
    attendeeIds: e.attendees.map((a) => a.id),
    followUps: [],
    attachmentIds: e.attachmentIds,
  };
}
