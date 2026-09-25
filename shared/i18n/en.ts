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
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
