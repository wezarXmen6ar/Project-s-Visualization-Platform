// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../../../shared/types';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import {
  mockFetch, sampleLists, samplePeople, sampleProject, sampleToDos, sampleWorkload, type MockHandler,
} from '../../testing/mockFetch';
import { CreateProjectPage } from './CreateProjectPage';
import { EditPhasesPage } from './EditPhasesPage';
import { EditProjectPage } from './EditProjectPage';
import { ManageDashboardPage } from './ManageDashboardPage';
import { ProjectPage } from './ProjectPage';

const calendar = { weekendDays: [0, 6], holidays: [] };
const sara: Me = { resourceId: 70, name: 'Sara Ahmed' };

function arabic(url: string, path: string, page: ReactNode) {
  return render(
    <LanguageProvider lang="ar">
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={path} element={page} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

/** Portal with a Development › Increment 1 sub-phase, a business PM with a phone and an email, and one scope item. */
function portal() {
  return sampleProject({
    projectManager: { id: 70, name: 'Sara Ahmed' },
    businessPm: { id: 80, name: 'Mariam Al Suwaidi', phone: '+971 50 123 4567', email: 'mariam@example.com' },
    priority: 'high',
    category: 'strategic',
    requester: { internal: true, external: false },
    beneficiary: { employees: true, customers: true },
    scopeItems: [{ id: 5, kind: 'scope', text: 'Online payments', order: 0, dateAdded: '2026-09-24' }],
    phases: [
      { id: 11, name: 'Requirements gathering', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
      {
        id: 12, name: 'Development', order: 1, durationDays: 3, start: '2026-09-28', end: '2026-09-30',
        subPhases: [{ id: 120, name: 'Increment 1', order: 0, durationDays: 3, start: '2026-09-28', end: '2026-09-30', withPrevious: false }],
      },
    ],
    assignments: [{ id: 300, phaseId: 12, resource: { id: 71, name: 'Fatima Noor' }, allocation: 60, role: 'responsible' }],
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the project screens in Arabic', () => {
  it('shows the dashboard in Arabic, with the Jira key left to right and the project name as user content', async () => {
    mockFetch({
      'GET /api/projects': () => ({ body: [sampleProject()] }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    arabic('/manage', '/manage', <ManageDashboardPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'المشاريع' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'خطواتي القادمة' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'إضافة مشروع جديد' })).toHaveAttribute('href', '/manage/projects/new');
    expect(await screen.findByRole('heading', { name: 'الجدول الزمني' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'المشروع' })).toBeInTheDocument();
    expect(screen.getByText(/حدِّد المستخدم الحالي في/)).toBeInTheDocument();
    const name = screen.getByRole('link', { name: 'Portal' });
    expect(name).toHaveAttribute('dir', 'auto');
    expect(name).toHaveAttribute('data-user-content');
    expect(screen.getByText('PRJ-1')).toHaveAttribute('dir', 'ltr');
  });

  it('shows My next steps in Arabic, with Arabic due labels', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    mockFetch({
      'GET /api/projects': () => ({ body: [] }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
      'GET /api/settings/me': () => ({ body: sara }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/todos?assigneeId=70': () => ({
        body: sampleToDos().map((t) => ({ ...t, assignee: { id: 70, name: 'Sara Ahmed' } })),
      }),
    });
    arabic('/manage', '/manage', <ManageDashboardPage />);

    expect(await screen.findByText('Chase the missing contract')).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('متأخرة · الخميس 1 أكتوبر')).toBeInTheDocument();
    expect(screen.getByText('التسليم: الثلاثاء 20 أكتوبر')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'كل المهام' })).toBeInTheDocument();
    expect(await screen.findByText(/التطوير › Increment 1/)).toBeInTheDocument();
    expect(screen.getByText('لا توجد مشاريع بعد')).toBeInTheDocument();
  });

  it('shows the project page in Arabic', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T09:00:00'));
    mockFetch({
      'GET /api/projects/1': () => ({ body: portal() }),
      'GET /api/settings/calendar': () => ({ body: calendar }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: sampleToDos() }),
      'GET /api/settings/me': () => ({ body: sara }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
    });
    const user = userEvent.setup();
    arabic('/manage/projects/1', '/manage/projects/:id', <ProjectPage />);

    const title = await screen.findByRole('heading', { level: 1, name: 'Portal' });
    expect(title).toHaveAttribute('dir', 'auto');
    expect(screen.getByRole('heading', { name: 'الجدول الزمني' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'السجل' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^المهام/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'فريق العمل' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'المرفقات' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'التفاصيل' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'خطواتي القادمة' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'التفاصيل' }));
    expect(screen.getByRole('heading', { name: 'التفاصيل' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تعديل المراحل' })).toBeInTheDocument();
    expect(screen.getByText(/الخميس 24 سبتمبر 2026 ← الأربعاء 30 سبتمبر 2026 · 5 أيام عمل/)).toBeInTheDocument();
    expect(screen.getByText('عالية')).toBeInTheDocument();
    expect(screen.getByText('استراتيجي')).toBeInTheDocument();
    expect(screen.getByText('الموظفين والجمهور')).toBeInTheDocument();
    expect(screen.getByText('+971 50 123 4567')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('mariam@example.com')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('PRJ-1')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('Online payments')).toHaveAttribute('dir', 'auto');

    const table = screen.getByRole('table');
    expect(within(table).getByText('جمع المتطلبات')).toBeInTheDocument();
    expect(within(table).getAllByText('الاثنين 28 سبتمبر 2026')).toHaveLength(2);
    // The arrow marker sits outside the dir="auto" span, so the two are checked separately.
    const subPhaseName = within(table).getByText('Increment 1');
    expect(subPhaseName).toHaveAttribute('dir', 'auto');
    expect(subPhaseName.closest('td')).toHaveTextContent('↲ Increment 1');

    // People: the phase's Arabic name, and the allocation line with the Arabic role.
    await user.click(screen.getByRole('tab', { name: 'فريق العمل' }));
    expect(await screen.findByText('60% · مسؤول', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعديل الأشخاص في التطوير › Increment 1' })).toBeInTheDocument();

    // To-dos: Arabic buttons, labels and the done toggle.
    await user.click(screen.getByRole('tab', { name: /^المهام/ }));
    expect(screen.getByRole('button', { name: 'إضافة مهمة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إظهار المهمة المنجزة' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'منجزة: Book the UAT room' })).toBeInTheDocument();
  });

  it('shows the to-do form in Arabic', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: portal() }),
      'GET /api/settings/calendar': () => ({ body: calendar }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
    });
    const user = userEvent.setup();
    arabic('/manage/projects/1?tab=todos', '/manage/projects/:id', <ProjectPage />);

    await user.click(await screen.findByRole('button', { name: 'إضافة مهمة' }));
    expect(screen.getByLabelText('العنوان')).toHaveAttribute('dir', 'auto');
    const assignee = screen.getByLabelText('المكلَّف');
    expect(within(assignee).getByRole('option', { name: 'بدون تكليف' })).toBeInTheDocument();
    expect(within(assignee).getByRole('option', { name: 'Mariam Al Suwaidi (مدير مشروع مالك العملية)' })).toBeInTheDocument();
    const phase = screen.getByLabelText('المرحلة');
    expect(within(phase).getByRole('option', { name: 'المشروع كاملاً' })).toBeInTheDocument();
    expect(within(phase).getByRole('option', { name: 'التطوير › Increment 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ المهمة' })).toBeInTheDocument();
  });

  it('offers starter to-dos in Arabic with an Arabic plural', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: portal() }),
      'GET /api/settings/calendar': () => ({ body: calendar }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
      'GET /api/projects/1/starter-suggestions': () => ({
        body: [
          { phaseId: 11, phaseName: 'Requirements gathering', title: 'Book the kick-off' },
          { phaseId: 11, phaseName: 'Requirements gathering', title: 'List the stakeholders' },
          { phaseId: 11, phaseName: 'Requirements gathering', title: 'Collect the forms' },
        ],
      }),
    });
    arabic('/manage/projects/1?starter=all', '/manage/projects/:id', <ProjectPage />);

    expect(await screen.findByRole('heading', { name: 'مهام جاهزة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة 3 مهام' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تخطّي' })).toBeInTheDocument();
  });

  it('ArrowLeft moves focus to the next tab in Arabic (right to left)', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: portal() }),
      'GET /api/settings/calendar': () => ({ body: calendar }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [] }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
    });
    const user = userEvent.setup();
    arabic('/manage/projects/1', '/manage/projects/:id', <ProjectPage />);

    const historyTab = await screen.findByRole('tab', { name: 'السجل' });
    historyTab.focus();
    await user.keyboard('{ArrowLeft}');
    const todosTab = screen.getByRole('tab', { name: /^المهام/ });
    expect(todosTab).toHaveFocus();
    expect(todosTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the wizard steps in Arabic', async () => {
    mockFetch({
      'GET /api/settings/calendar': () => ({ body: calendar }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
    });
    const user = userEvent.setup();
    arabic('/manage/projects/new', '/manage/projects/new', <CreateProjectPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'مشروع جديد' })).toBeInTheDocument();
    const steps = document.querySelector('.wizard-steps') as HTMLElement;
    for (const step of ['المعلومات الأساسية', 'الوصف والنطاق', 'المراحل', 'الأشخاص']) {
      expect(within(steps).getByText(step)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Jira key')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText('اسم المشروع')).toHaveAttribute('dir', 'auto');
    expect(screen.getByLabelText('الأولوية')).toHaveDisplayValue('متوسطة');

    await user.type(screen.getByLabelText('اسم المشروع'), 'Portal');
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByRole('heading', { name: 'النطاق والأهداف' })).toBeInTheDocument();
    expect(screen.getByLabelText('عنصر نطاق جديد')).toBeInTheDocument();
    expect(screen.getByLabelText('خلفية عن المشروع')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByRole('button', { name: 'إضافة مرحلة' })).toBeInTheDocument();
    expect(screen.getByLabelText('اسم المرحلة 1')).toHaveDisplayValue('جمع المتطلبات');
    expect(screen.getByLabelText('أيام عمل المرحلة 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'إضافة مرحلة فرعية إلى المرحلة 4' }));
    const subName = screen.getByLabelText('اسم المرحلة الفرعية 1 من المرحلة 4');
    expect(subName).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('تبدأ مع بداية المرحلة')).toBeInTheDocument();
    await user.type(subName, 'Increment 1');

    await user.click(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByRole('button', { name: 'إنشاء المشروع' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة شخص إلى جمع المتطلبات' })).toBeInTheDocument();
  });

  it('shows Edit details in Arabic', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: portal() }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
    });
    arabic('/manage/projects/1/edit', '/manage/projects/:id/edit', <EditProjectPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'تعديل التفاصيل' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ التغييرات' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تعديل المراحل' })).toBeInTheDocument();
    expect(screen.getByLabelText('مدير المشروع (التقني)')).toBeInTheDocument();
    expect(screen.getByText('الجهة الطالبة')).toBeInTheDocument();
    expect(screen.getByLabelText('عنصر نطاق 1')).toHaveAttribute('dir', 'auto');
  });

  it('warns about removed phases in Arabic, with Arabic plurals and و', async () => {
    const project = sampleProject({
      phases: [
        { id: 11, name: 'Requirements gathering', order: 0, durationDays: 2, start: '2026-09-24', end: '2026-09-25', subPhases: [] },
        {
          id: 12, name: 'Development', order: 1, durationDays: 10, start: '2026-09-28', end: '2026-10-09',
          subPhases: [
            { id: 21, name: 'Increment 1', order: 0, durationDays: 5, start: '2026-09-28', end: '2026-10-02', withPrevious: false },
            { id: 22, name: 'Increment 2', order: 1, durationDays: 5, start: '2026-10-05', end: '2026-10-09', withPrevious: false },
          ],
        },
      ],
      assignments: [
        { id: 900, phaseId: 21, resource: { id: 71, name: 'Fatima Noor' }, allocation: 50, role: 'contributor' },
        { id: 901, phaseId: 21, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'contributor' },
        { id: 902, phaseId: 11, resource: { id: 72, name: 'Rami Saleh' }, allocation: 50, role: 'contributor' },
      ],
    });
    const todo = (id: number) => ({
      id, projectId: 1, projectName: 'Portal', title: `T${id}`, note: null, assignee: null, dueDate: null, done: false,
      doneDate: null, formerPhase: null, createdAt: '2026-09-20T09:00:00.000Z',
      phase: { id: 21, name: 'Development › Increment 1', phaseName: 'Development', subPhaseName: 'Increment 1' },
    });
    const routes: Record<string, MockHandler> = {
      'GET /api/projects/1': () => ({ body: project }),
      'GET /api/todos?projectId=1&done=include': () => ({ body: [todo(300), todo(301), todo(302)] }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/settings/calendar': () => ({ body: calendar }),
    };
    mockFetch(routes);
    const user = userEvent.setup();
    arabic('/manage/projects/1/phases', '/manage/projects/:id/phases', <EditPhasesPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'تعديل المراحل' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إزالة المرحلة الفرعية 1 من المرحلة 2' }));
    await user.click(screen.getByRole('button', { name: 'إزالة المرحلة 1' }));
    await user.click(screen.getByRole('button', { name: 'حفظ المراحل' }));

    expect(
      await screen.findByText(
        'سيؤدي الحفظ إلى حذف جمع المتطلبات (شخص واحد) والتطوير › Increment 1 (شخصان، 3 مهام غير منجزة). وسيُلغى تكليف الأشخاص فيها.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'إبقاؤها في المشروع' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'حفظ على أي حال' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'متابعة التعديل' })).toBeInTheDocument();
  });
});
