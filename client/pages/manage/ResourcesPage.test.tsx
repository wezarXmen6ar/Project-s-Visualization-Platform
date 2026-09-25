// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockFetch, sampleLists, samplePeople } from '../../testing/mockFetch';
import { ResourcesPage } from './ResourcesPage';

const routes = {
  'GET /api/resources': () => ({ body: samplePeople() }),
  'GET /api/lists': () => ({ body: sampleLists() }),
};

const renderPage = () => render(<MemoryRouter><ResourcesPage /></MemoryRouter>);
/** The people table (Task 7 adds a second table, the workload heatmap, to this page). */
const peopleTable = () => screen.findByRole('table', { name: 'People' });
const names = async () => within(await peopleTable()).getAllByRole('link').map((a) => a.textContent);

describe('ResourcesPage', () => {
  it('lists everyone with their side, role, capacity and contact', async () => {
    mockFetch(routes);
    renderPage();
    const table = within(await peopleTable());
    const rami = table.getByRole('link', { name: 'Rami Saleh' });
    expect(rami).toHaveAttribute('href', '/manage/resources/72');
    const row = rami.closest('tr')!;
    expect(within(row).getByText('Tech team')).toBeInTheDocument();
    expect(within(row).getByText('Developer · Back end')).toBeInTheDocument();
    expect(within(row).getByText('80%')).toBeInTheDocument();
    const mariam = table.getByRole('link', { name: 'Mariam Al Suwaidi' }).closest('tr')!;
    expect(within(mariam).getByText('Business side')).toBeInTheDocument();
    expect(within(mariam).getByText('+971 50 123 4567 · mariam@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add person' })).toHaveAttribute('href', '/manage/resources/new');
  });

  it('filters by side and by role', async () => {
    mockFetch(routes);
    const user = userEvent.setup();
    renderPage();
    await peopleTable();
    await user.selectOptions(screen.getByLabelText('Side'), 'Business side');
    expect(await names()).toEqual(['Mariam Al Suwaidi']);
    await user.selectOptions(screen.getByLabelText('Side'), 'Everyone');
    await user.selectOptions(screen.getByLabelText('Role'), 'Developer');
    expect(await names()).toEqual(['Fatima Noor', 'Rami Saleh']);
  });

  it('invites adding people when there are none', async () => {
    mockFetch({ ...routes, 'GET /api/resources': () => ({ body: [] }) });
    renderPage();
    expect(await screen.findByText('No one yet. Add your team and your business-side contacts.')).toBeInTheDocument();
  });
});
