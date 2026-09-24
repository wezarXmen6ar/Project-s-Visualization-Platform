import { z } from 'zod';
import { isISODate } from './calendar';

export const isoDate = z.string().refine(isISODate, 'Must be a valid date (YYYY-MM-DD)');

export const phaseInputSchema = z.object({
  name: z.string().trim().min(1, 'Phase name is required').max(200),
  durationDays: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be a whole number of days')
    .min(1, 'Duration must be at least 1 working day')
    .max(2000, 'Duration is too long'),
});

export const newProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  jiraKey: z
    .string()
    .trim()
    .max(50)
    .nullish()
    .transform((v) => (v ? v : null)),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #3b82f6'),
  startDate: isoDate,
  phases: z.array(phaseInputSchema).min(1, 'Add at least one phase'),
});

export type NewProjectInput = z.input<typeof newProjectSchema>;
export type NewProject = z.output<typeof newProjectSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}
