import type { Message } from './types';

/**
 * The English catalogue. Its keys are the source of `MessageKey`, so every key here must also be in `ar.ts`
 * (the Arabic catalogue is typed `Record<MessageKey, Message>`, so a missing or extra key fails the typecheck).
 * Keys are namespaced by area: `common.*`, `lang.*`, `landing.*`, `notFound.*`, …
 */
export const en = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.remove': 'Remove',
  'common.add': 'Add',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.loading': 'Loading…',
  'common.none': 'None',
  'common.notSet': 'Not set',

  'lang.switch': 'Language',
  'lang.ar': 'العربية',
  'lang.en': 'English',

  'landing.title': 'Project Portfolio',
  'landing.subtitle': 'Choose what you want to do.',
  'landing.manage': 'Project Management',
  'landing.manageDescription': 'Create and manage projects, phases and people.',
  'landing.present': 'Project Presentation',
  'landing.presentDescription': 'Show the portfolio to stakeholders.',

  'notFound.title': 'Page not found',
  'notFound.body': 'This page does not exist yet.',
  'notFound.back': 'Back to start',

  // A column heading in the weekly workload heatmap, e.g. "Week 42".
  'heatmap.week': 'Week {number}',

  // Zod schema messages (shared/schemas.ts). The string passed to zod is the key itself, so `toIssues` can turn it
  // back into English text and a `code`, byte-identical to what these fields used to hard-code.
  'validation.invalid': 'Invalid value',
  'validation.invalidDate': 'Must be a valid date (YYYY-MM-DD)',
  'validation.uaeMobile': 'Enter a UAE mobile number, e.g. +971 50 123 4567',
  'validation.email': 'Enter a valid email address',
  'validation.choosePerson': 'Choose a person',
  'validation.allocationNumber': 'Allocation must be a number',
  'validation.allocationWholeNumber': 'Allocation must be a whole number',
  'validation.allocationRange': 'Allocation must be between 1% and 100%',
  'validation.samePersonTwice': 'The same person is assigned twice to this phase',
  'validation.durationNumber': 'Duration must be a number',
  'validation.durationWholeNumber': 'Duration must be a whole number of days',
  'validation.durationMin': 'Duration must be at least 1 working day',
  'validation.durationTooLong': 'Duration is too long',
  'validation.phaseNameRequired': 'Phase name is required',
  'validation.subPhaseNameRequired': 'Sub-phase name is required',
  'validation.maxSubPhases': 'A phase can have at most 100 sub-phases',
  'validation.addAtLeastOnePhase': 'Add at least one phase',
  'validation.itemTextEmpty': 'Item text cannot be empty',
  'validation.projectNameRequired': 'Project name is required',
  'validation.colorFormat': 'Colour must look like #3b82f6',
  'validation.nameRequired': 'Name is required',
  'validation.nameTooLong': 'Name is too long',
  'validation.capacityNumber': 'Capacity must be a number',
  'validation.capacityWholeNumber': 'Capacity must be a whole number',
  'validation.capacityRange': 'Capacity must be between 1% and 100%',
  'validation.endDateAfterStart': 'End date must be on or after the start date',
  'validation.weekMustBeMonday': 'Week must start on a Monday',
  'validation.writeWhatNeedsDoing': 'Write what needs doing',
  'validation.titleUnder200': 'Keep the title under 200 characters',

  // Server-built errors (grep server/ for `message:`, `error:`, `issues.push`). Params carry the pieces that change
  // (names, counts); the English text below reproduces the exact old sentence.
  'error.unknownList': 'Unknown list',
  'error.listValueNotFound': 'Value not found',
  'error.listValueExists': '"{name}" already exists',
  'error.personNotFound': 'Person not found',
  'error.leaveNotFound': 'Leave not found',
  'error.projectNotFound': 'Project not found',
  'error.phaseNotFound': 'Phase not found',
  'error.todoNotFound': 'To-do not found',
  'error.starterNotFound': 'Starter to-do not found',
  'error.chooseTechTeamMember': 'Choose someone from your tech team',
  'error.invalidYear': 'year must be a whole number between 2000 and 2100',
  'error.unknownRole': 'Unknown role',
  'error.unknownPerson': 'Unknown person',
  'error.notTechTeam': '{name} is a business contact; only the tech team can be assigned',
  'error.personInactive': '{name} is inactive',
  'error.unknownMainProject': 'Unknown main project',
  'error.unknownProjectType': 'Unknown project type',
  'error.unknownGoal': 'Unknown goal',
  'error.unknownDepartment': 'Unknown business user (department)',
  'error.unknownProjectManager': 'Unknown project manager (tech)',
  'error.unknownBusinessPm': 'Unknown business project manager',
  'error.phaseAppearsTwice': 'The same phase appears twice',
  'error.unknownPhase': 'Unknown phase',
  'error.unknownSubPhase': 'Unknown sub-phase',
  'error.personNotOnProject': "{name} isn't on this project",
  'error.personInUseDelete': "{name} can't be deleted because {reasons}. Make them inactive instead.",
  'error.personInUseSideChange': "{name} can't change side because {reasons}.",
  'error.reasonPmOnProjects': {
    one: 'they are a project manager on {count} project',
    other: 'they are a project manager on {count} projects',
  },
  'error.reasonAssignedPhases': {
    one: 'they are assigned to {count} phase',
    other: 'they are assigned to {count} phases',
  },
  'error.reasonHasTodos': {
    one: 'they have {count} to-do',
    other: 'they have {count} to-dos',
  },
  'error.listValueInUseProjects': {
    one: '"{name}" is used by {count} project',
    other: '"{name}" is used by {count} projects',
  },
  'error.listValueInUsePeople': {
    one: '"{name}" is used by {count} person',
    other: '"{name}" is used by {count} people',
  },
  'error.phaseHasStarters': {
    one: '"{name}" has {count} starter to-do; delete them in Starter to-dos first',
    other: '"{name}" has {count} starter to-dos; delete them in Starter to-dos first',
  },
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
