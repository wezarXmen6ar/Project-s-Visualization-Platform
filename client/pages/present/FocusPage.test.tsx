// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleProject } from '../../testing/mockFetch';
import { FocusPage } from './FocusPage';

describe('FocusPage', () => {
  it('shows one project read-only with its phases', async () => {
    mockFetch({ 'GET /api/projects/1': () => ({ body: sampleProject() }) });
    render(
      <MemoryRouter initialEntries={['/present/projects/1']}>
        <Routes>
          <Route path="/present/projects/:id" element={<FocusPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.getByTestId('gantt-row-11')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Portfolio/ })).toHaveAttribute('href', '/present?year=2026');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
