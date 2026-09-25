// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { mockFetch, sampleLists, sampleProject } from '../../testing/mockFetch';
import { FocusPage } from './FocusPage';
import { PortfolioPage } from './PortfolioPage';

describe('the presentation screens in Arabic', () => {
  it('shows the portfolio in Arabic', async () => {
    mockFetch({
      'GET /api/portfolio?year=2026': () => ({
        body: { year: 2026, today: '2026-09-24', stats: { active: 1, finishedThisYear: 2, startingThisYear: 3 }, projects: [sampleProject()] },
      }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter initialEntries={['/present?year=2026']}>
          <Routes><Route path="/present" element={<PortfolioPage />} /></Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'محفظة المشاريع' })).toBeInTheDocument();
    expect(screen.getByText('قيد التنفيذ حالياً')).toBeInTheDocument();
    expect(screen.getByText('انتهت في 2026')).toBeInTheDocument();
    expect(screen.getByText('مقرر أن تبدأ في 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'السنة السابقة' })).toHaveTextContent('›');
    expect(screen.getByRole('button', { name: 'السنة التالية' })).toHaveTextContent('‹');
    expect(screen.getByRole('link', { name: '→ البداية' })).toHaveAttribute('href', '/');
  });

  it('shows the focus view in Arabic', async () => {
    mockFetch({
      'GET /api/projects/1': () => ({ body: sampleProject({ phases: [] }) }),
      'GET /api/settings/calendar': () => ({ body: { weekendDays: [0, 6], holidays: [] } }),
      'GET /api/lists': () => ({ body: sampleLists() }),
    });
    render(
      <LanguageProvider lang="ar">
        <MemoryRouter initialEntries={['/present/projects/1']}>
          <Routes><Route path="/present/projects/:id" element={<FocusPage />} /></Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Portal' })).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('لا توجد مراحل بعد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '→ محفظة المشاريع' })).toBeInTheDocument();
  });
});
