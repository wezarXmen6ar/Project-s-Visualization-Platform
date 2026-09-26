// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lang } from '../../shared/i18n/types';
import type {
  AttachmentRecord, EntryRecord, Lists, Me, ProjectRecord, ResourceRecord, StarterToDo, ToDoRecord, WorkloadData,
} from '../../shared/types';
import { App } from '../App';
import { ProjectPage } from '../pages/manage/ProjectPage';
import { ToDosPage } from '../pages/manage/ToDosPage';
import { mockFetch, sampleLists, samplePeople, sampleProject, sampleToDos, type MockHandler } from '../testing/mockFetch';
import { LanguageProvider } from './LanguageProvider';

/*
 * The "no English left behind" guard: every main page, rendered in Arabic with Arabic user content, must show no
 * app-generated English. It walks every text node, and every aria-label, placeholder, title and alt attribute (plus
 * the values of inputs the app fills in), and reports any Latin-letter word that is not on the allowlist.
 */

// ---------------------------------------------------------------------------------------------------------------
// The walker
// ---------------------------------------------------------------------------------------------------------------

/**
 * Terms the glossary keeps in English, and codes and formats that are not words. They are blanked out before the
 * check, so "Jira key PRJ-106" or "مريم@example.com" pass.
 */
const ALLOWED: RegExp[] = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, // email addresses, including the name@example.com placeholder
  /\bPRJ-\d*/g, // Jira keys and the PRJ-123 placeholder
  /\bJira key\b/g,
  /\bGantt chart\b/g,
  /\bChange Request\b/g,
  /\bJira\b/g,
  /\bMilestone\b/g,
  /\bCR\b/g,
  /\bQA\b/g,
  /\bUAT\b/g,
  /\bBRD\b/g,
  /\bYYYY(?:-MM-DD)?\b/g, // a date-format hint
  /#[0-9a-fA-F]{3,8}\b/g, // the colour hex placeholder
];

/** A Latin-letter word. The brief's minimum is a run of two; single words are caught too, since "Save" alone is a leftover. */
const LATIN_WORD = /[A-Za-z]+(?:['’-][A-Za-z]+)*(?:\s+[A-Za-z]+(?:['’-][A-Za-z]+)*)*/g;

const CHECKED_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'];

export function englishIn(text: string): string[] {
  let rest = text;
  for (const re of ALLOWED) rest = rest.replace(re, ' ¦ ');
  return rest.match(LATIN_WORD) ?? [];
}

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = el.getAttribute('class')?.trim().split(/\s+/)[0];
  const role = el.getAttribute('role');
  return `${tag}${cls ? `.${cls}` : ''}${role ? `[role=${role}]` : ''}`;
}

function pathOf(el: Element): string {
  const parts: string[] = [];
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) parts.unshift(describeElement(e));
  return parts.join(' > ');
}

/** Every leftover English string under `root`, with where it was found. User content and `lang="en"` text are skipped. */
export function findEnglish(root: Element): string[] {
  const found: string[] = [];
  const report = (where: Element, what: string, text: string) => {
    for (const word of englishIn(text)) found.push(`"${word}" in ${what} of ${pathOf(where)} (full text: "${text.trim()}")`);
  };
  const visit = (el: Element) => {
    if (el.hasAttribute('data-user-content')) return;
    const lang = el.getAttribute('lang');
    if (lang && !lang.startsWith('ar')) return; // e.g. the "English" button, written in its own language
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return;
    for (const attr of CHECKED_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value) report(el, `@${attr}`, value);
    }
    const typed = tag === 'textarea' || (tag === 'input' && ['text', 'search', 'email', 'tel', 'url'].includes((el as HTMLInputElement).type));
    if (typed) {
      const value = (el as HTMLInputElement).value;
      if (value) report(el, 'value', value);
    }
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) report(el, 'text', child.textContent);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        visit(child as Element);
      }
    }
  };
  visit(root);
  return found;
}

function expectNoEnglish(page: string) {
  const found = findEnglish(document.body);
  expect(found, `English left on ${page}:\n  ${found.join('\n  ')}`).toEqual([]);
}

// ---------------------------------------------------------------------------------------------------------------
// Arabic fixtures: project, people, phases, to-dos and list names are all Arabic, so only app text can trip the guard.
// ---------------------------------------------------------------------------------------------------------------

const PROJECT = 'بوابة الخدمات الذكية';
const OTHER_PROJECT = 'نظام إدارة القضايا';
const SARA = 'سارة أحمد';
const FATIMA = 'فاطمة نور';
const RAMI = 'رامي صالح';
const MARIAM = 'مريم السويدي';
const INCREMENT = 'الإصدار الأول';

function arabicLists(): Lists {
  const lists = sampleLists();
  lists.mainProject = [{ id: 20, list: 'mainProject', name: 'Digital Services', order: 0, nameAr: 'الخدمات الرقمية' }];
  lists.department = [{ id: 30, list: 'department', name: 'Customer Service', order: 0, nameAr: 'خدمة المتعاملين' }];
  lists.goal = [...lists.goal, { id: 5, list: 'goal', name: 'Improve customer experience', order: 1, nameAr: 'تحسين تجربة المتعاملين' }];
  return lists;
}

function arabicPeople(): ResourceRecord[] {
  const names: Record<number, string> = { 70: SARA, 71: FATIMA, 72: RAMI, 80: MARIAM };
  return samplePeople().map((p) => ({
    ...p,
    name: names[p.id],
    email: p.id === 80 ? 'mariam@example.com' : p.email,
    leave: p.id === 72 ? [{ id: 5, start: '2026-10-19', end: '2026-10-20', note: 'دورة تدريبية' }] : p.leave,
    projects: p.projects.map((pr) => ({ ...pr, name: OTHER_PROJECT })),
  }));
}

function arabicProject(): ProjectRecord {
  return sampleProject({
    name: PROJECT,
    jiraKey: 'PRJ-106',
    startDate: '2026-09-24',
    priority: 'high',
    projectManager: { id: 70, name: SARA },
    businessPm: { id: 80, name: MARIAM, phone: '+971 50 123 4567', email: 'mariam@example.com' },
    mainProject: { id: 20, name: 'Digital Services', nameAr: 'الخدمات الرقمية' },
    category: 'strategic',
    projectType: { id: 2, name: 'Customer', nameAr: 'الجمهور' },
    goal: { id: 5, name: 'Improve customer experience', nameAr: 'تحسين تجربة المتعاملين' },
    department: { id: 30, name: 'Customer Service', nameAr: 'خدمة المتعاملين' },
    requester: { internal: true, external: true },
    beneficiary: { employees: true, customers: true },
    background: 'يتعامل المتعاملون اليوم مع عدة منصات منفصلة لإنجاز معاملاتهم.',
    summary: 'بوابة موحدة تجمع الخدمات الإلكترونية في مكان واحد.',
    scopeItems: [
      { id: 1, kind: 'scope', text: 'الدخول الموحد عبر الهوية الرقمية', order: 0, dateAdded: '2026-09-24' },
      { id: 2, kind: 'out-of-scope', text: 'تطبيق الهاتف المتحرك', order: 0, dateAdded: '2026-09-24' },
      { id: 3, kind: 'problem', text: 'تكرار إدخال البيانات في كل خدمة', order: 0, dateAdded: '2026-09-24' },
      { id: 4, kind: 'objective', text: 'إنجاز 80% من المعاملات إلكترونياً', order: 0, dateAdded: '2026-09-24' },
    ],
    phases: [
      { id: 11, name: 'Requirements gathering', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      {
        id: 12, name: 'Development', order: 1, durationDays: 10, start: '2026-09-28', end: '2026-10-09',
        subPhases: [{ id: 120, name: INCREMENT, order: 0, durationDays: 10, start: '2026-09-28', end: '2026-10-09', withPrevious: false }],
      },
      { id: 13, name: 'QA', order: 2, durationDays: 5, start: '2026-10-12', end: '2026-10-16', subPhases: [] },
    ],
    assignments: [
      { id: 300, phaseId: 120, resource: { id: 71, name: FATIMA }, allocation: 60, role: 'responsible' },
      { id: 301, phaseId: 13, resource: { id: 72, name: RAMI }, allocation: 40, role: 'contributor' },
    ],
  });
}

function arabicToDos(): ToDoRecord[] {
  const titles = [
    'متابعة العقد المتأخر', 'حجز قاعة اختبار القبول', 'إعداد قائمة التشغيل', 'التأكد من جاهزية بيئة الاختبار',
    'مراجعة نطاق الإصدار الأول', 'الحصول على اعتماد مالك العملية',
  ];
  return sampleToDos().map((t, i) => ({
    ...t,
    title: titles[i],
    projectName: PROJECT,
    assignee: t.assignee ? { id: 80, name: MARIAM } : t.id === 200 ? { id: 70, name: SARA } : null,
    phase: t.phase ? { id: 120, name: `Development › ${INCREMENT}`, phaseName: 'Development', subPhaseName: INCREMENT } : null,
    note: t.id === 201 ? 'بالتنسيق مع مالك العملية' : t.note,
  })).concat({
    id: 206, projectId: 1, projectName: PROJECT, title: 'مهمة من مرحلة محذوفة', note: null, assignee: null, dueDate: null,
    done: false, doneDate: null, phase: null, sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
    formerPhase: { name: 'Design', phaseName: 'Design', subPhaseName: null, removedOn: '2026-10-02' },
  });
}

function arabicEntries(): EntryRecord[] {
  return [
    {
      id: 300, projectId: 1, type: 'meeting', effectiveDate: '2026-09-24', createdAt: '2026-09-20T09:00:00.000Z',
      title: 'اجتماع الانطلاق', highlight: true,
      body: 'السطر الأول.\nالسطر الثاني.\nالسطر الثالث.\nالسطر الرابع.',
      phase: { id: 120, name: `Development › ${INCREMENT}`, phaseName: 'Development', subPhaseName: INCREMENT },
      attendees: [{ id: 70, name: SARA }, { id: 71, name: FATIMA }],
      attachmentIds: [401], followUpToDoIds: [200],
    },
  ];
}

function arabicAttachments(): AttachmentRecord[] {
  return [
    {
      id: 400, projectId: 1,
      phase: { id: 120, name: `Development › ${INCREMENT}`, phaseName: 'Development', subPhaseName: INCREMENT },
      entryId: null, type: { id: 101, name: 'Approval', nameAr: 'اعتماد' }, name: 'خطاب الاعتماد.pdf', mime: 'application/pdf',
      size: 245_000, documentDate: '2026-09-20', uploadedAt: '2026-09-21T09:00:00.000Z', previewable: true,
    },
    {
      id: 401, projectId: 1, phase: null, entryId: 300, type: { id: 100, name: 'Meeting Minutes', nameAr: 'محضر اجتماع' },
      name: 'محضر.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 18_000, documentDate: null, uploadedAt: '2026-09-24T10:00:00.000Z', previewable: false,
    },
  ];
}

function arabicWorkload(): WorkloadData {
  return {
    calendar: { weekendDays: [0, 6], holidays: [] },
    resources: [
      { id: 71, name: FATIMA, capacity: 100, leave: [] },
      { id: 72, name: RAMI, capacity: 80, leave: [{ start: '2026-10-19', end: '2026-10-20' }] },
    ],
    assignments: [
      {
        id: 500, resourceId: 71, phaseId: 120, projectId: 1, projectName: PROJECT, phaseName: `Development › ${INCREMENT}`,
        topPhaseName: 'Development', subPhaseName: INCREMENT, start: '2026-09-28', end: '2026-10-09', allocation: 60, role: 'responsible',
      },
      {
        id: 501, resourceId: 71, phaseId: 901, projectId: 91, projectName: OTHER_PROJECT, phaseName: 'QA', topPhaseName: 'QA',
        subPhaseName: null, start: '2026-10-05', end: '2026-10-09', allocation: 60, role: 'contributor',
      },
      {
        id: 502, resourceId: 72, phaseId: 13, projectId: 1, projectName: PROJECT, phaseName: 'QA', topPhaseName: 'QA',
        subPhaseName: null, start: '2026-10-12', end: '2026-10-16', allocation: 40, role: 'contributor',
      },
    ],
    decisions: [],
  };
}

const me: Me = { resourceId: 70, name: SARA };
const starters: StarterToDo[] = [{ id: 1, phaseListId: 55, title: 'كتابة حالات الاختبار', order: 0 }];

function arabicRoutes(): Record<string, MockHandler> {
  const project = arabicProject();
  const todos = arabicToDos();
  return {
    'GET /api/projects': () => ({ body: [project] }),
    'GET /api/projects/1': () => ({ body: project }),
    'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
    'GET /api/settings/me': () => ({ body: me }),
    'GET /api/lists': () => ({ body: arabicLists() }),
    'GET /api/resources': () => ({ body: arabicPeople() }),
    'GET /api/workload': () => ({ body: arabicWorkload() }),
    'GET /api/todos?done=include': () => ({ body: todos }),
    'GET /api/todos?projectId=1&done=include': () => ({ body: todos }),
    'GET /api/projects/1/entries': () => ({ body: arabicEntries() }),
    'GET /api/projects/1/entries?phaseId=12': () => ({ body: arabicEntries() }),
    'GET /api/projects/1/entries?phaseId=13': () => ({ body: [] }),
    'GET /api/projects/1/attachments': () => ({ body: arabicAttachments() }),
    'GET /api/todos?assigneeId=70': () => ({ body: todos.filter((t) => t.assignee?.id === 70) }),
    'GET /api/todos?assigneeId=72': () => ({ body: [{ ...todos[1], assignee: { id: 72, name: RAMI } }] }),
    'GET /api/starter-todos': () => ({ body: starters }),
    'GET /api/projects/1/starter-suggestions': () => ({
      body: [{ phaseId: 11, phaseName: 'Requirements gathering', title: 'حصر الجهات المعنية' }],
    }),
    'GET /api/backups': () => ({ body: { latest: '2026-10-05', count: 3 } }),
    'GET /api/portfolio?year=2026': () => ({
      body: { year: 2026, today: '2026-10-07', stats: { active: 1, finishedThisYear: 2, startingThisYear: 3 }, projects: [project] },
    }),
  };
}

function renderApp(url: string, lang: Lang = 'ar') {
  return render(
    <LanguageProvider lang={lang}>
      <MemoryRouter initialEntries={[url]}>
        <App />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

/** Waits until nothing on the page is still loading. */
async function settled() {
  await waitFor(() => expect(document.body.textContent).not.toMatch(/جارٍ التحميل|Loading/));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T09:00:00'));
  mockFetch(arabicRoutes());
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------------------------------------------

describe('the English guard itself', () => {
  it('catches English words and allows the glossary terms, codes and formats', () => {
    expect(englishIn('حفظ التغييرات')).toEqual([]);
    expect(englishIn('Jira key: PRJ-106 · Gantt chart · ضمان الجودة (QA) · Change Request (CR) · Milestone · UAT')).toEqual([]);
    expect(englishIn('mariam@example.com · +971 50 123 4567 · #3b82f6 · PRJ-123 · name@example.com')).toEqual([]);
    expect(englishIn('Save changes')).toEqual(['Save changes']);
    expect(englishIn('تم Loading')).toEqual(['Loading']);
  });

  it('lists each English string with where it was found, and skips user content', () => {
    const { container } = render(
      <main className="page">
        <h2>المهام</h2>
        <button type="button" aria-label="Add to-do">+</button>
        <p data-user-content dir="auto">E-Services Mobile App</p>
        <span className="hint">Nothing here yet</span>
      </main>,
    );
    expect(findEnglish(container)).toEqual([
      '"Add to-do" in @aria-label of div > main.page > button (full text: "Add to-do")',
      '"Nothing here yet" in text of div > main.page > span.hint (full text: "Nothing here yet")',
    ]);
  });
});

describe('no English left in the Arabic pages', () => {
  it('the landing page', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expectNoEnglish('the landing page');
  });

  it('the dashboard, with the overbooking notice and My next steps', async () => {
    renderApp('/manage');
    expect(await screen.findByText('متابعة العقد المتأخر')).toBeInTheDocument();
    await screen.findAllByRole('link', { name: PROJECT });
    await screen.findByRole('link', { name: 'عرض عبء العمل' });
    await settled();
    expectNoEnglish('the dashboard');
  });

  it('the project page, with its tabs, to-do form and people editor open', async () => {
    const user = userEvent.setup();
    renderApp('/manage/projects/1');
    await screen.findByRole('heading', { level: 1, name: PROJECT });
    await screen.findByRole('tab', { name: 'السجل' });
    await settled();
    await screen.findByText('اجتماع الانطلاق');
    expectNoEnglish('the project page');

    await user.click(screen.getByRole('button', { name: 'تعديل اجتماع الانطلاق' }));
    expectNoEnglish('the project page with the History tab, an entry open for edit');
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));

    await user.click(screen.getByRole('button', { name: 'إضافة اجتماع' }));
    expectNoEnglish('the project page with the History tab, the add-meeting form open');
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));

    await user.click(screen.getByRole('tab', { name: 'الأشخاص' }));
    await screen.findByText('60% · مسؤول', { exact: false });
    expectNoEnglish('the project page on the People tab');

    await user.click(screen.getByRole('button', { name: `تعديل الأشخاص في التطوير › ${INCREMENT}` }));
    expectNoEnglish('the project page with the people editor open');

    await user.click(screen.getByRole('tab', { name: /^المهام/ }));
    await user.click(screen.getByRole('button', { name: 'إضافة مهمة' }));
    expectNoEnglish('the project page with the to-do form open');
    await user.click(screen.getByRole('button', { name: 'إلغاء' }));

    await user.click(screen.getByRole('tab', { name: 'المرفقات' }));
    await screen.findByText('خطاب الاعتماد.pdf');
    expectNoEnglish('the project page on the Attachments tab');

    await user.click(screen.getByRole('button', { name: 'رفع ملف' }));
    expectNoEnglish('the project page with the upload row open');

    await user.click(screen.getByRole('button', { name: 'معاينة خطاب الاعتماد.pdf' }));
    expectNoEnglish('the project page with a file preview dialog open');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('tab', { name: 'التفاصيل' }));
    expectNoEnglish('the project page on the Details tab');
  });

  it('the phase side panel on the project page, grouped both ways and with each form open', async () => {
    const user = userEvent.setup();
    renderApp('/manage/projects/1?phase=12');
    const panel = await screen.findByRole('dialog', { name: 'التطوير' });
    await within(panel).findByText('اجتماع الانطلاق');
    await within(panel).findByText('خطاب الاعتماد.pdf');
    await settled();
    expectNoEnglish('the project page with the phase side panel open');

    await user.click(within(panel).getByRole('radio', { name: 'حسب النوع' }));
    expectNoEnglish('the phase side panel grouped by type');

    await user.click(within(panel).getByRole('button', { name: 'إضافة اجتماع' }));
    expectNoEnglish('the phase side panel with the add-meeting form open');
    await user.click(within(panel).getByRole('button', { name: 'إلغاء' }));

    await user.click(within(panel).getByRole('button', { name: 'إضافة مهمة' }));
    expectNoEnglish('the phase side panel with the to-do form open');
    await user.click(within(panel).getByRole('button', { name: 'إلغاء' }));

    await user.click(within(panel).getByRole('button', { name: 'رفع ملف' }));
    expectNoEnglish('the phase side panel with the uploader open');
  });

  it('the read-only phase side panel in the focus view', async () => {
    renderApp('/present/projects/1?phase=12');
    const panel = await screen.findByRole('dialog', { name: 'التطوير' });
    await within(panel).findByText('اجتماع الانطلاق');
    await settled();
    expectNoEnglish('the focus view with the phase side panel open');
  });

  it('the read-only phase side panel with nothing to show', async () => {
    renderApp('/present/projects/1?phase=13');
    await screen.findByText('لا يوجد ما يُعرض لهذه المرحلة بعد.');
    await settled();
    expectNoEnglish('the focus view with an empty phase side panel');
  });

  it('the project page offering starter to-dos', async () => {
    renderApp('/manage/projects/1?starter=all');
    await screen.findByRole('heading', { name: 'مهام جاهزة' });
    await settled();
    expectNoEnglish('the starter to-dos offer');
  });

  it('the wizard, steps 1 to 4', async () => {
    const user = userEvent.setup();
    renderApp('/manage/projects/new');
    await screen.findByRole('heading', { level: 1, name: 'مشروع جديد' });
    await settled();
    expectNoEnglish('wizard step 1');

    await user.type(screen.getByLabelText('اسم المشروع'), PROJECT);
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    await screen.findByRole('heading', { name: 'النطاق والأهداف' });
    expectNoEnglish('wizard step 2');

    await user.click(screen.getByRole('button', { name: 'التالي' }));
    await screen.findByRole('button', { name: 'إضافة مرحلة' });
    await user.click(screen.getByRole('button', { name: 'إضافة مرحلة فرعية إلى المرحلة 4' }));
    await user.type(screen.getByLabelText('اسم المرحلة الفرعية 1 من المرحلة 4'), INCREMENT);
    expectNoEnglish('wizard step 3');

    await user.click(screen.getByRole('button', { name: 'التالي' }));
    await screen.findByRole('button', { name: 'إنشاء المشروع' });
    await user.click(screen.getByRole('button', { name: 'إضافة شخص إلى جمع المتطلبات' }));
    expectNoEnglish('wizard step 4');
  });

  it('Edit details', async () => {
    renderApp('/manage/projects/1/edit');
    await screen.findByRole('heading', { level: 1, name: 'تعديل التفاصيل' });
    await settled();
    expectNoEnglish('Edit details');
  });

  it('Edit phases, with the removal warning', async () => {
    const user = userEvent.setup();
    renderApp('/manage/projects/1/phases');
    await screen.findByRole('heading', { level: 1, name: 'تعديل المراحل' });
    await settled();
    expectNoEnglish('Edit phases');

    await user.click(screen.getByRole('button', { name: 'إزالة المرحلة 3' }));
    await user.click(screen.getByRole('button', { name: 'حفظ المراحل' }));
    await screen.findByRole('button', { name: 'حفظ على أي حال' });
    expectNoEnglish('Edit phases with the removal warning');
  });

  it('Resources, in Days and Weeks, with an overbooked week open', async () => {
    const user = userEvent.setup();
    renderApp('/manage/resources');
    await screen.findByRole('table', { name: 'الأشخاص' });
    await screen.findByRole('table', { name: 'عبء العمل' });
    await settled();
    expectNoEnglish('Resources (Days)');

    await user.click(screen.getByRole('button', { name: /^فاطمة نور، الثلاثاء 6 أكتوبر/ }));
    await screen.findByRole('heading', { name: 'هذا الأسبوع فوق الطاقة. ما الإجراء الذي تريده؟' });
    expectNoEnglish('Resources with an overbooked day open');

    await user.click(screen.getByRole('button', { name: 'أسابيع' }));
    expectNoEnglish('Resources (Weeks)');
  });

  it('the person page, and a new person', async () => {
    renderApp('/manage/resources/72');
    await screen.findByRole('heading', { level: 1, name: RAMI });
    await screen.findByRole('heading', { name: 'يعمل حالياً على' });
    await settled();
    expectNoEnglish('the person page');
  });

  it('the new-person page', async () => {
    renderApp('/manage/resources/new');
    await screen.findByRole('heading', { level: 1 });
    await settled();
    expectNoEnglish('the new-person page');
  });

  it('To-dos', async () => {
    renderApp('/manage/todos');
    await screen.findByText('متابعة العقد المتأخر');
    await screen.findByRole('checkbox', { name: 'من مراحل محذوفة' });
    await settled();
    expectNoEnglish('To-dos');
  });

  it('Settings', async () => {
    renderApp('/manage/settings');
    await screen.findByRole('heading', { name: 'مهام جاهزة' });
    await screen.findByRole('heading', { name: 'النسخ الاحتياطية' });
    await settled();
    expectNoEnglish('Settings');
  });

  it('the portfolio', async () => {
    renderApp('/present');
    await screen.findByRole('heading', { level: 1, name: 'محفظة المشاريع' });
    await screen.findAllByText(PROJECT);
    await settled();
    expectNoEnglish('the portfolio');
  });

  it('the focus view', async () => {
    renderApp('/present/projects/1');
    await screen.findByRole('heading', { name: PROJECT });
    await settled();
    expectNoEnglish('the focus view');
  });

  it('the not-found page', async () => {
    renderApp('/nowhere');
    await screen.findByRole('heading', { level: 1 });
    expectNoEnglish('the not-found page');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Mixed direction
// ---------------------------------------------------------------------------------------------------------------

describe('mixed-direction content', () => {
  it('an English project name inside an Arabic page reads left to right on its own', async () => {
    const routes = arabicRoutes();
    const english = { ...arabicProject(), name: 'E-Services Mobile App' };
    routes['GET /api/projects/1'] = () => ({ body: english });
    routes['GET /api/projects'] = () => ({ body: [english] });
    mockFetch(routes);

    renderApp('/manage/projects/1');
    const title = await screen.findByRole('heading', { level: 1, name: 'E-Services Mobile App' });
    expect(title).toHaveAttribute('dir', 'auto');
    expect(screen.getByRole('heading', { name: 'الجدول الزمني' })).toBeInTheDocument();
    await settled();
    // The English name is user content, so the guard lets it through.
    expectNoEnglish('the Arabic project page with an English project name');
  });

  it('an Arabic to-do title inside an English page reads right to left on its own', async () => {
    const todos: ToDoRecord[] = [{ ...sampleToDos()[0], title: 'مراجعة نطاق الإصدار الأول' }];
    mockFetch({
      'GET /api/todos?done=include': () => ({ body: todos }),
      'GET /api/settings/me': () => ({ body: me }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    render(
      <LanguageProvider lang="en">
        <MemoryRouter initialEntries={['/manage/todos']}>
          <Routes><Route path="/manage/todos" element={<ToDosPage />} /></Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'To-dos' })).toBeInTheDocument();
    const title = await screen.findByText('مراجعة نطاق الإصدار الأول');
    expect(title).toHaveAttribute('dir', 'auto');
    expect(title).toHaveAttribute('data-user-content');
  });

  it('an English sub-phase name inside the Arabic project page keeps its own direction', async () => {
    const routes = arabicRoutes();
    const project = arabicProject();
    project.phases[1].subPhases[0].name = 'Increment 1';
    routes['GET /api/projects/1'] = () => ({ body: project });
    mockFetch(routes);
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter initialEntries={['/manage/projects/1?tab=details']}>
          <Routes><Route path="/manage/projects/:id" element={<ProjectPage />} /></Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
    const table = await screen.findByRole('table');
    // The arrow marker sits outside the dir="auto" span, so the two are checked separately.
    const subPhaseName = within(table).getByText('Increment 1');
    expect(subPhaseName).toHaveAttribute('dir', 'auto');
    expect(subPhaseName.closest('td')).toHaveTextContent('↲ Increment 1');
  });
});
