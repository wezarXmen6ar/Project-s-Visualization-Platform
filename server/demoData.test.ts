import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { DEFAULT_CALENDAR } from '../shared/calendar';
import { newProjectSchema } from '../shared/schemas';
import { computeWorkload } from '../shared/capacity';
import { phaseName } from '../client/i18n/listNames';
import { workloadData } from './assignments/repo';
import { openDb } from './db';
import { DEMO_ARABIC_PROJECT, DEMO_PEOPLE, DEMO_PROJECTS, makeDemoPdf, seedDemo, toProjectInput } from './demoData';

describe('makeDemoPdf', () => {
  it('writes plain-ASCII text, even for an Arabic file name, and escapes brackets', () => {
    const arabic = makeDemoPdf('محضر ورشة المتطلبات.pdf').toString('latin1');
    expect(arabic).toContain('(PVP demo document) Tj');
    expect([...arabic].every((c) => c.charCodeAt(0) < 128)).toBe(true);
    expect(makeDemoPdf('UAT (final).pdf').toString('latin1')).toContain(String.raw`(UAT \(final\).pdf) Tj`);
  });
});
import { getLists } from './lists/repo';
import { listProjects } from './projects/repo';
import { listResources } from './resources/repo';
import { getMe } from './settings';
import { listStarters } from './starters/repo';
import { listToDos } from './todos/repo';
import { listEntries } from './entries/repo';
import { getAttachmentFile, listAttachments } from './attachments/repo';
import { listKeyDates } from './keyDates/repo';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pvp-demo-data-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('DEMO_PROJECTS', () => {
  it('are all valid projects with unique names', () => {
    expect(DEMO_PROJECTS).toHaveLength(7);
    for (const demo of DEMO_PROJECTS) {
      expect(
        newProjectSchema.safeParse(
          toProjectInput(demo, () => 1, (name) => DEMO_PEOPLE.findIndex((p) => p.name === name) + 1),
        ).success,
      ).toBe(true);
    }
    expect(new Set(DEMO_PROJECTS.map((p) => p.name)).size).toBe(DEMO_PROJECTS.length);
  });
});

describe('seedDemo', () => {
  it('adds every demo project with its details, grouping some under main projects', () => {
    const db = openDb(':memory:');
    expect(seedDemo(db, DEFAULT_CALENDAR, dir)).toBe(DEMO_PROJECTS.length);

    const projects = listProjects(db);
    expect(projects).toHaveLength(DEMO_PROJECTS.length);
    const groups = new Set(projects.map((p) => p.mainProject?.name).filter(Boolean));
    expect(groups).toEqual(new Set(['Digital Services', 'Records Modernisation']));
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')).toMatchObject({
      projectType: { name: 'Customer' },
      department: { name: 'Customer Service' },
      priority: 'high',
    });
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')!.scopeItems.length).toBeGreaterThan(0);
    expect(projects.find((p) => p.name === 'Customer Portal Revamp')).toMatchObject({
      projectManager: { name: 'Sara Ahmed' },
      businessPm: { name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam.alsuwaidi@example.com' },
    });

    // The default project types are reused, not duplicated.
    expect(getLists(db).projectType.map((v) => v.name)).toEqual(['Criminal', 'Customer', 'Management']);

    // Every demo phase is a name from the Phases list, so the phase dropdowns show it.
    const phaseNames = new Set(getLists(db).phase.map((v) => v.name));
    for (const p of projects) for (const ph of p.phases) expect(phaseNames).toContain(ph.name);
    // Legacy Archive Migration still sits entirely in 2025.
    const legacy = projects.find((p) => p.name === 'Legacy Archive Migration')!;
    expect(legacy.phases[legacy.phases.length - 1].end < '2026-01-01').toBe(true);
  });

  it('staffs every demo phase and shows real overbookings and leave around October 2026', () => {
    const db = openDb(':memory:');
    seedDemo(db, DEFAULT_CALENDAR, dir);
    for (const p of listProjects(db)) {
      for (const ph of p.phases) {
        expect(p.assignments.some((a) => a.phaseId === ph.id)).toBe(true);
        for (const sub of ph.subPhases) expect(p.assignments.some((a) => a.phaseId === sub.id)).toBe(true);
      }
    }

    const data = workloadData(db);
    expect(data.resources.map((r) => r.name)).not.toContain('Mariam Al Suwaidi');
    expect(data.resources.find((r) => r.name === 'Rami Saleh')?.capacity).toBe(80);

    const loads = computeWorkload(data.resources, data.assignments, { start: '2026-10-05', end: '2026-10-25' }, data.calendar);
    const week = (name: string, weekStart: string) => loads.find((l) => l.name === name)!.weeks.find((w) => w.weekStart === weekStart)!;

    // Case Management UAT (50%) + E-Services requirements gathering (100%).
    expect(week('Aisha Khan', '2026-10-05')).toMatchObject({ load: 150, available: 100, overloaded: true });
    // Case Management security testing (100%) during 3 days of training leave.
    expect(week('Jonas Weber', '2026-10-19')).toMatchObject({ leaveDays: 3, load: 100, available: 40, overloaded: true });
    // A full week of annual leave with nothing booked.
    expect(week('Fatima Noor', '2026-10-12')).toMatchObject({ leaveDays: 5, available: 0, overloaded: false });
  });

  it('splits E-Services development into increments, and gives the PM to-dos and starter checklists', () => {
    const db = openDb(':memory:');
    seedDemo(db, DEFAULT_CALENDAR, dir);
    const app = listProjects(db).find((p) => p.name === 'E-Services Mobile App')!;
    const dev = app.phases.find((ph) => ph.name === 'Development')!;
    expect(dev).toMatchObject({ start: '2026-11-30', end: '2027-02-19' });
    expect(dev.subPhases.map((s) => [s.name, s.start, s.end, s.withPrevious])).toEqual([
      ['Increment 1 – Sign-in and profile', '2026-11-30', '2026-12-18', false],
      ['Increment 2 – Service catalogue', '2026-11-30', '2026-12-18', true],
      ['Increment 3 – Payments', '2026-12-21', '2027-01-22', false],
      ['Increment 4 – Notifications', '2027-01-25', '2027-02-19', false],
    ]);
    const onDev = app.assignments.filter((a) => a.phaseId === dev.id).map((a) => a.resource.name);
    expect(onDev).toEqual(['Hassan Ali']);
    for (const s of dev.subPhases) expect(app.assignments.some((a) => a.phaseId === s.id)).toBe(true);

    const me = getMe(db);
    expect(me.name).toBe('Sara Ahmed');
    // The Arabic project's two to-dos (2027) are checked in their own test; this one covers the M5 demo.
    const english = (t: { projectName: string }) => t.projectName !== DEMO_ARABIC_PROJECT;
    const mine = listToDos(db, { assigneeId: me.resourceId! }).filter(english);
    expect(mine.map((t) => t.title)).toEqual([
      'Send the app store account request to IT',
      'Confirm the requirements workshop dates with Mariam',
      'Check the go-live checklist with operations',
      'Share the release plan with the business',
    ]);
    // A follow-up to-do from the Requirements workshop meeting (M7 Task 10) is checked in its own test; this one
    // keeps the M5 demo's original count.
    const all = listToDos(db, { includeDone: true }).filter(english).filter((t) => t.sourceEntry === null);
    expect(all).toHaveLength(10);
    expect(all.find((t) => t.title.startsWith('Review the payment'))?.phase?.name).toBe('Development › Increment 3 – Payments');
    expect(all.find((t) => t.title === 'Confirm the security testing slot')).toMatchObject({ done: true, doneDate: '2026-09-24' });

    expect(listStarters(db)).toHaveLength(6);
  });

  it('adds one fully Arabic project, and Arabic names for the demo list values', () => {
    const db = openDb(':memory:');
    expect(seedDemo(db, DEFAULT_CALENDAR, dir)).toBe(7);
    const arabic = /[؀-ۿ]/;
    const latinWords = /[A-Za-z]{2,}/;

    const lists = getLists(db);
    for (const list of ['department', 'mainProject', 'goal', 'projectType', 'phase', 'role'] as const) {
      for (const v of lists[list]) expect(v.nameAr, `${list}: ${v.name}`).toMatch(arabic);
    }
    expect(lists.mainProject.find((v) => v.name === 'Digital Services')?.nameAr).toBe('الخدمات الرقمية');
    expect(lists.department.find((v) => v.name === 'Customer Service')?.nameAr).toBe('خدمة المتعاملين');

    expect(DEMO_ARABIC_PROJECT).toBe('بوابة الخدمات الذكية');
    const project = listProjects(db).find((p) => p.name === DEMO_ARABIC_PROJECT)!;
    expect(project).toMatchObject({ startDate: '2027-01-10', mainProject: { nameAr: 'الخدمات الرقمية' } });
    expect(project.background).toMatch(arabic);
    expect(project.summary).toMatch(arabic);
    for (const kind of ['scope', 'out-of-scope', 'problem', 'objective'] as const) {
      expect(project.scopeItems.some((i) => i.kind === kind), kind).toBe(true);
    }
    for (const item of project.scopeItems) expect(item.text).not.toMatch(latinWords);
    expect(project.phases[0].start >= '2027-01-10').toBe(true);
    // Stored under their English names, so they display in Arabic through the Phases list.
    for (const ph of project.phases) expect(phaseName(ph.name, lists, 'ar'), ph.name).toMatch(arabic);

    const todos = listToDos(db, { includeDone: true }).filter((t) => t.projectName === DEMO_ARABIC_PROJECT);
    expect(todos).toHaveLength(2);
    for (const t of todos) {
      expect(t.title).toMatch(arabic);
      expect(t.title).not.toMatch(latinWords);
      expect(t.assignee?.name).toBe('Sara Ahmed');
    }
  });

  // M7 Task 10: meetings, updates, files, outsourced people, person documents and key dates.
  describe('demo meetings, updates, files, outsourced people, person documents and key dates', () => {
    let db: DatabaseSync;
    let app: ReturnType<typeof buildApp>;

    beforeEach(() => {
      db = openDb(':memory:');
      seedDemo(db, DEFAULT_CALENDAR, dir);
      app = buildApp(db, { attachmentsDir: dir, today: () => '2026-09-26' });
    });

    function resourceByName(name: string) {
      return listResources(db).find((r) => r.name === name)!;
    }

    it('gives E-Services two entries: a highlighted workshop with attendees, a follow-up and a minutes file', () => {
      const eServices = listProjects(db).find((p) => p.name === 'E-Services Mobile App')!;
      const entries = listEntries(db, eServices.id);
      expect(entries).toHaveLength(2);

      const workshop = entries.find((e) => e.title === 'Requirements workshop')!;
      expect(workshop.highlight).toBe(true);
      expect(workshop.attendees.map((a) => a.name).sort()).toEqual(['Aisha Khan', 'Mariam Al Suwaidi', 'Sara Ahmed']);
      expect(workshop.guests).toEqual(['Saeed Al Nuaimi (Dubai Police IT)']);
      expect(workshop.followUpToDoIds).toHaveLength(1);
      const followUp = listToDos(db, { includeDone: true }).find((t) => t.id === workshop.followUpToDoIds[0])!;
      expect(followUp).toMatchObject({ title: 'Share the draft requirements list', dueDate: '2026-10-14' });
      expect(followUp.assignee?.name).toBe('Aisha Khan');

      expect(workshop.attachmentIds).toHaveLength(1);
      const attachment = listAttachments(db, eServices.id).find((a) => a.id === workshop.attachmentIds[0])!;
      expect(attachment.name).toBe('Requirements workshop minutes.pdf');
      const file = getAttachmentFile(db, attachment.id)!;
      const bytes = readFileSync(join(dir, String(eServices.id), file.storedName));
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');

      const update = entries.find((e) => e.title === 'Requirements gathering on track')!;
      expect(update.highlight).toBe(false);
    });

    it('gives the Arabic project a highlighted workshop with an Arabic title and an Arabic file name', () => {
      const project = listProjects(db).find((p) => p.name === DEMO_ARABIC_PROJECT)!;
      const entries = listEntries(db, project.id);
      const workshop = entries.find((e) => e.title === 'ورشة جمع المتطلبات')!;
      expect(workshop.highlight).toBe(true);
      expect(workshop.attachmentIds).toHaveLength(1);
      const attachment = listAttachments(db, project.id).find((a) => a.id === workshop.attachmentIds[0])!;
      expect(attachment.name).toBe('محضر ورشة المتطلبات.pdf');
      const file = getAttachmentFile(db, attachment.id)!;
      const bytes = readFileSync(join(dir, String(project.id), file.storedName));
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('highlights exactly 4 entries across the demo', () => {
      const highlighted = listProjects(db).flatMap((p) => listEntries(db, p.id)).filter((e) => e.highlight);
      expect(highlighted).toHaveLength(4);
    });

    it('every demo attachment file exists on disk and starts with %PDF', () => {
      for (const p of listProjects(db)) {
        for (const a of listAttachments(db, p.id)) {
          const file = getAttachmentFile(db, a.id)!;
          const bytes = readFileSync(join(dir, String(p.id), file.storedName));
          expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
        }
      }
    });

    it('outsources Omar Farid to E-Services, engaged, and absent from workloadData; Lena Park shows as past', () => {
      const omar = resourceByName('Omar Farid');
      expect(omar.employment).toBe('outsourced');
      expect(omar.engagement).toBe('engaged');
      expect(omar.engagementProject).toEqual({ id: expect.any(Number), name: 'E-Services Mobile App' });
      expect(omar.company?.name).toBe('TechNova Solutions');
      expect(omar.residence).toBe('abroad');

      const load = workloadData(db);
      expect(load.resources.map((r) => r.name)).not.toContain('Omar Farid');

      const eServices = listProjects(db).find((p) => p.name === 'E-Services Mobile App')!;
      const increment4 = eServices.phases.find((p) => p.name === 'Development')!.subPhases.find((s) => s.name.startsWith('Increment 4'))!;
      expect(eServices.assignments.some((a) => a.phaseId === increment4.id && a.resource.name === 'Omar Farid')).toBe(true);

      const lena = resourceByName('Lena Park');
      expect(lena.employment).toBe('outsourced');
      expect(lena.engagement).toBe('past');
    });

    it('has Hassan Ali as staff, contracted through TechNova, and Fatima Noor living in the UAE', () => {
      const hassan = resourceByName('Hassan Ali');
      expect(hassan.employment).toBe('staff');
      expect(hassan.company?.name).toBe('TechNova Solutions');
      expect(hassan.residence).toBe('abroad');

      const fatima = resourceByName('Fatima Noor');
      expect(fatima.residence).toBe('uae');
    });

    it('GET /api/people/expiring?withinDays=30 returns Fatima\'s passport, Omar\'s police clearance and Fatima\'s network account, not Hassan\'s VPN', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/people/expiring?withinDays=30' });
      expect(res.statusCode).toBe(200);
      const items = res.json() as { kind: string; name: string | null; person: { name: string }; state: string }[];

      const passport = items.find((i) => i.kind === 'document' && i.person.name === 'Fatima Noor' && i.name?.includes('passport'));
      expect(passport?.state).toBe('soon');

      const clearance = items.find((i) => i.kind === 'document' && i.person.name === 'Omar Farid' && i.name?.includes('police'));
      expect(clearance?.state).toBe('expired');

      const network = items.find((i) => i.kind === 'account' && i.person.name === 'Fatima Noor');
      expect(network).toBeDefined();

      expect(items.some((i) => i.kind === 'account' && i.person.name === 'Hassan Ali')).toBe(false);
    });

    it('GET /api/key-dates/upcoming?withinDays=30 returns the E-Services license expiry and Case Management support end', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/key-dates/upcoming?withinDays=30' });
      expect(res.statusCode).toBe(200);
      const items = res.json() as { project: { name: string }; type: { name: string } | null; date: string }[];

      expect(items.some((i) => i.project.name === 'E-Services Mobile App' && i.type?.name === 'License expiry' && i.date === '2026-10-15')).toBe(
        true,
      );
      expect(
        items.some((i) => i.project.name === 'Case Management System' && i.type?.name === 'Support end' && i.date === '2026-09-20'),
      ).toBe(true);
    });

    it("links E-Services' three key dates to its Contract attachment, and gives Case Management's support end no file", () => {
      const eServices = listProjects(db).find((p) => p.name === 'E-Services Mobile App')!;
      const keyDates = listKeyDates(db, eServices.id, '2026-09-26');
      expect(keyDates).toHaveLength(3);
      for (const kd of keyDates) expect(kd.attachment?.name).toBe('E-Services contract.pdf');

      const caseMgmt = listProjects(db).find((p) => p.name === 'Case Management System')!;
      const supportEnd = listKeyDates(db, caseMgmt.id, '2026-09-26').find((kd) => kd.type?.name === 'Support end')!;
      expect(supportEnd.attachment).toBeNull();
      expect(supportEnd.date).toBe('2026-09-20');
    });
  });
});
