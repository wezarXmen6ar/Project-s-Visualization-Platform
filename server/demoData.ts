import type { NewProjectInput } from '../shared/schemas';

export const DEMO_PROJECTS: NewProjectInput[] = [
  {
    name: 'Legacy Archive Migration', jiraKey: 'PRJ-099', color: '#64748b', startDate: '2025-09-07',
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'Customer Portal Revamp', jiraKey: 'PRJ-101', color: '#2563eb', startDate: '2026-01-11',
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 50 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Go-live', durationDays: 2 },
    ],
  },
  {
    name: 'HR Self-Service', jiraKey: 'PRJ-102', color: '#16a34a', startDate: '2026-02-01',
    phases: [
      { name: 'Requirements gathering', durationDays: 8 },
      { name: 'Business analysis', durationDays: 8 },
      { name: 'Development', durationDays: 40 },
      { name: 'QA', durationDays: 10 },
      { name: 'UAT', durationDays: 5 },
    ],
  },
  {
    name: 'Case Management System', jiraKey: 'PRJ-103', color: '#9333ea', startDate: '2026-03-15',
    phases: [
      { name: 'Requirements gathering', durationDays: 15 },
      { name: 'Business analysis', durationDays: 15 },
      { name: 'Design', durationDays: 10 },
      { name: 'Development', durationDays: 80 },
      { name: 'QA', durationDays: 20 },
      { name: 'UAT', durationDays: 10 },
      { name: 'Go-live', durationDays: 3 },
    ],
  },
  {
    name: 'Internal Reporting Dashboard', jiraKey: 'PRJ-104', color: '#ea580c', startDate: '2026-06-01',
    phases: [
      { name: 'Requirements gathering', durationDays: 5 },
      { name: 'Development', durationDays: 25 },
      { name: 'QA', durationDays: 8 },
      { name: 'UAT', durationDays: 5 },
    ],
  },
  {
    name: 'E-Services Mobile App', jiraKey: 'PRJ-105', color: '#0891b2', startDate: '2026-10-04',
    phases: [
      { name: 'Requirements gathering', durationDays: 10 },
      { name: 'Business analysis', durationDays: 10 },
      { name: 'Design', durationDays: 15 },
      { name: 'Development', durationDays: 60 },
      { name: 'QA', durationDays: 15 },
      { name: 'UAT', durationDays: 10 },
    ],
  },
];
