// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResourceRecord, ToDoRecord } from '../../../shared/types';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { overloadsWith, phaseWarnings } from '../../overloads';
import {
  mockFetch, overbookedWorkload, sampleLists, samplePeople, sampleProject, sampleToDos, sampleWorkload,
} from '../../testing/mockFetch';
import { FocusPage } from '../present/FocusPage';
import { ManageDashboardPage } from './ManageDashboardPage';
import { PersonPage } from './PersonPage';
import { ResourcesPage } from './ResourcesPage';
import { SettingsPage } from './SettingsPage';
import { ToDosPage } from './ToDosPage';

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

function setToday(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${iso}T09:00:00`));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the people, workload, to-dos and settings screens in Arabic', () => {
  it('shows Resources in Arabic: heading, Days | Weeks switch, People table and legend', async () => {
    setToday('2026-10-14');
    mockFetch({
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/workload': () => ({ body: overbookedWorkload() }),
    });
    arabic('/manage/resources', '/manage/resources', <ResourcesPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'الموارد' })).toBeInTheDocument();
    const views = screen.getByRole('group', { name: 'عرض عبء العمل حسب' });
    expect(within(views).getByRole('button', { name: 'أيام' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(views).getByRole('button', { name: 'أسابيع' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'هذا الأسبوع' })).toBeInTheDocument();
    expect(document.querySelector('.heat-legend')).toHaveTextContent('فوق الطاقة');
    expect(document.querySelector('.heat-legend')).toHaveTextContent('إجازة');

    const table = await screen.findByRole('table', { name: 'الأشخاص' });
    for (const header of ['الاسم', 'الجهة', 'الدور', 'المشاريع', 'نسبة التفرغ', 'التواصل', 'الحالة']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    const rami = within(table).getByRole('link', { name: 'Rami Saleh' }).closest('tr')!;
    expect(within(rami).getByText('الفريق التقني')).toBeInTheDocument();
    expect(within(rami).getByText('مطوّر · الواجهة الخلفية')).toBeInTheDocument();
    expect(within(rami).getByText('نشط')).toBeInTheDocument();
    const mariam = within(table).getByRole('link', { name: 'Mariam Al Suwaidi' }).closest('tr')!;
    expect(within(mariam).getByText('مالك العملية')).toBeInTheDocument();
    expect(within(mariam).getByText('+971 50 123 4567 · mariam@example.com')).toHaveAttribute('dir', 'ltr');
  });

  it('opens an overbooked week in Arabic, with the decision prompt', async () => {
    setToday('2026-10-14');
    mockFetch({
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/workload': () => ({ body: overbookedWorkload() }),
    });
    const user = userEvent.setup();
    arabic('/manage/resources', '/manage/resources', <ResourcesPage />);

    const workload = await screen.findByRole('table', { name: 'عبء العمل' });
    expect(within(workload).getByRole('columnheader', { name: 'الشخص' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Fatima Noor، الثلاثاء 6 أكتوبر: محجوز 160% من أصل 100% متاح، فوق الطاقة' }),
    );
    expect(screen.getByRole('heading', { name: 'Fatima Noor · الاثنين 5 أكتوبر – الجمعة 9 أكتوبر' })).toBeInTheDocument();
    const clashes = screen.getByRole('list', { name: 'أيام تتجاوز الطاقة' });
    expect(within(clashes).getByText('الثلاثاء 6 أكتوبر: محجوز 160% من أصل 100% متاح')).toBeInTheDocument();
    expect(screen.getByText('Portal · التطوير: 60% لمدة 5 أيام')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'هذا الأسبوع فوق الطاقة. ما الإجراء الذي تريده؟' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تقسيم الوقت' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة التكليف' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'قبول المخاطرة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إيقاف مشروع مؤقتاً' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'تأجيل مرحلة' })).toBeDisabled();
  });

  it('shows the Weeks heatmap cells in Arabic, with leave', async () => {
    setToday('2026-10-14');
    mockFetch({
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
    });
    const user = userEvent.setup();
    arabic('/manage/resources', '/manage/resources', <ResourcesPage />);

    await user.click(await screen.findByRole('button', { name: 'أسابيع' }));
    expect(
      await screen.findByRole('button', {
        name: 'Rami Saleh، الاثنين 19 أكتوبر – الجمعة 23 أكتوبر: محجوز 0% من أصل 48% متاح، غير محجوز، في إجازة الاثنين 19 أكتوبر – الثلاثاء 20 أكتوبر',
      }),
    ).toBeInTheDocument();
  });

  it('writes the overbooking warning lines in Arabic, with leave days as an Arabic plural', () => {
    const data = sampleWorkload();
    const rami = { resourceId: 72, start: '2026-10-05', end: '2026-10-23', allocation: 40, projectName: 'Portal', phaseName: 'Dev' };
    expect(phaseWarnings(overloadsWith(data, [rami]), { start: '2026-10-05', end: '2026-10-09' }, data.calendar, 'ar').get(72)).toEqual([
      'الاثنين 5 أكتوبر – الجمعة 9 أكتوبر: محجوز 100% من أصل 80% متاح',
    ]);
    const heavy = overloadsWith(data, [{ ...rami, allocation: 80 }]);
    expect(phaseWarnings(heavy, { start: '2026-10-19', end: '2026-10-23' }, data.calendar, 'ar').get(72)).toEqual([
      'الاثنين 19 أكتوبر – الجمعة 23 أكتوبر: محجوز 80% من أصل 48% متاح (يوما إجازة)',
    ]);
  });

  it('shows the dashboard overbooking notice and the project dates in Arabic', async () => {
    setToday('2026-10-01');
    mockFetch({
      'GET /api/projects': () => ({ body: [sampleProject()] }),
      'GET /api/workload': () => ({ body: overbookedWorkload() }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    arabic('/manage', '/manage', <ManageDashboardPage />);

    expect(await screen.findByText('تجاوز الحِمل لدى Fatima Noor خلال الأسابيع الـ4 القادمة.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'عرض عبء العمل' })).toHaveAttribute('href', '/manage/resources');
    expect(await screen.findByRole('cell', { name: 'الخميس 24 سبتمبر 2026' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'الأربعاء 30 سبتمبر 2026' })).toBeInTheDocument();
  });

  it('shows the focus view span with Arabic dates', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    arabic('/present/projects/1', '/present/projects/:id', <FocusPage />);
    expect(await screen.findByText('الخميس 24 سبتمبر 2026 ← الأربعاء 30 سبتمبر 2026')).toBeInTheDocument();
  });

  it('shows the person page in Arabic', async () => {
    setToday('2026-10-07');
    const people: ResourceRecord[] = samplePeople().map((p) =>
      p.id === 72 ? { ...p, leave: [{ id: 5, start: '2026-10-19', end: '2026-10-20', note: null }] } : p,
    );
    const todo: ToDoRecord = {
      id: 400, projectId: 91, projectName: 'Case Management', title: 'Write the API tests', note: null,
      assignee: { id: 72, name: 'Rami Saleh' }, dueDate: null, done: false, doneDate: null, formerPhase: null,
      sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
      phase: { id: 901, name: 'Development', phaseName: 'Development', subPhaseName: null },
    };
    mockFetch({
      'GET /api/resources': () => ({ body: people }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/workload': () => ({ body: sampleWorkload() }),
      'GET /api/todos?assigneeId=72': () => ({ body: [todo] }),
    });
    arabic('/manage/resources/72', '/manage/resources/:id', <PersonPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Rami Saleh' })).toHaveAttribute('dir', 'auto');
    expect(screen.getByRole('link', { name: 'الموارد' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'الفريق التقني' })).toBeChecked();
    expect(screen.getByLabelText('الدور')).toHaveDisplayValue('مطوّر');
    expect(screen.getByLabelText('التخصص')).toHaveDisplayValue('الواجهة الخلفية');
    expect(screen.getByLabelText('نسبة التفرغ (%)')).toHaveValue(80);
    expect(screen.getByLabelText('رقم الجوال (إماراتي)')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('checkbox', { name: 'نشط' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'حذف الشخص' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ التغييرات' })).toBeInTheDocument();

    const work = (await screen.findByRole('heading', { name: 'يعمل حالياً على' })).closest('section')!;
    expect(await within(work).findByText('حالياً')).toBeInTheDocument();
    expect(within(work).getByText(/› التطوير/)).toBeInTheDocument();
    expect(within(work).getByText(/60% · مساهم/)).toBeInTheDocument();

    const todos = screen.getByRole('heading', { name: 'المهام' }).closest('section')!;
    expect(await within(todos).findByText('Write the API tests')).toBeInTheDocument();
    expect(within(todos).getByText(/· التطوير$/)).toBeInTheDocument();

    const leave = screen.getByRole('heading', { name: 'الإجازات' }).closest('section')!;
    expect(within(leave).getByText('الاثنين 19 أكتوبر 2026 ← الثلاثاء 20 أكتوبر 2026 · يوما عمل')).toBeInTheDocument();
    expect(within(leave).getByRole('button', { name: 'إضافة إجازة' })).toBeInTheDocument();
  });

  it('shows the To-dos page filters in Arabic', async () => {
    setToday('2026-10-07');
    const list: ToDoRecord[] = [
      ...sampleToDos(),
      {
        id: 301, projectId: 1, projectName: 'Portal', title: 'Kept from a removed phase', note: null, assignee: null,
        dueDate: null, done: false, doneDate: null, phase: null, sourceEntry: null, createdAt: '2026-09-20T09:00:00.000Z',
        formerPhase: { name: 'QA', phaseName: 'QA', subPhaseName: null, removedOn: '2026-10-02' },
      },
    ];
    mockFetch({
      'GET /api/todos?done=include': () => ({ body: list }),
      'GET /api/settings/me': () => ({ body: { resourceId: 70, name: 'Sara Ahmed' } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    arabic('/manage/todos', '/manage/todos', <ToDosPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'المهام' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('المشروع')).getByRole('option', { name: 'كل المشاريع' })).toBeInTheDocument();
    const assignee = screen.getByLabelText('المكلَّف');
    expect(await within(assignee).findByRole('option', { name: 'مهامي' })).toBeInTheDocument();
    expect(within(assignee).getByRole('option', { name: 'الجميع' })).toBeInTheDocument();
    expect(within(assignee).getByRole('option', { name: 'بدون تكليف' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'إظهار المنجزة' })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'من مراحل محذوفة' })).toBeInTheDocument();
    expect(await screen.findByText(/التطوير › Increment 1/)).toBeInTheDocument();
    expect(screen.getByText(/كانت ضمن ضمان الجودة \(QA\)/)).toBeInTheDocument();
  });

  it('shows Settings in Arabic', async () => {
    mockFetch({
      'GET /api/backups': () => ({ body: { latest: '2026-10-05', count: 3 } }),
      'GET /api/starter-todos': () => ({ body: [{ id: 1, phaseListId: 55, title: 'Write test cases', order: 0 }] }),
      'GET /api/lists': () => ({ body: sampleLists() }),
      'GET /api/resources': () => ({ body: samplePeople() }),
      'GET /api/settings/me': () => ({ body: { resourceId: null, name: null } }),
    });
    arabic('/manage/settings', '/manage/settings', <SettingsPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'الإعدادات' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'المستخدم الحالي' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'مهام جاهزة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الأهداف' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة هدف' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة تسمية التطوير' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'النسخ الاحتياطية' })).toBeInTheDocument();
    expect(screen.getByText('آخر نسخة احتياطية: الاثنين 5 أكتوبر 2026 · 3 نسخ محفوظة في مجلد النسخ الاحتياطية.')).toBeInTheDocument();
  });
});
