// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ListValue } from '../../../shared/types';
import { mockFetch, sampleLists, type MockHandler } from '../../testing/mockFetch';
import { SettingsPage } from './SettingsPage';

/** A small in-memory stand-in for the lists API, so reloads show the change. */
function fakeServer(): Record<string, MockHandler> {
  const lists = sampleLists();
  return {
    'GET /api/lists': () => ({ body: structuredClone(lists) }),
    'POST /api/lists/goal': (init) => {
      const value: ListValue = { id: 40, list: 'goal', name: JSON.parse(init!.body as string).name, order: lists.goal.length };
      lists.goal.push(value);
      return { status: 201, body: value };
    },
    'PUT /api/lists/projectType/2': (init) => {
      lists.projectType[1] = { ...lists.projectType[1], name: JSON.parse(init!.body as string).name };
      return { body: lists.projectType[1] };
    },
    'DELETE /api/lists/projectType/1': () => ({ status: 409, body: { error: '"Criminal" is used by 1 project' } }),
    'DELETE /api/lists/department/30': () => {
      lists.department = [];
      return { status: 204, body: null };
    },
  };
}

const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

describe('SettingsPage', () => {
  it('shows all four lists', async () => {
    mockFetch(fakeServer());
    renderPage();
    expect(await screen.findByText('Digital Services')).toBeInTheDocument();
    expect(screen.getByText('Criminal')).toBeInTheDocument();
    expect(screen.getByText('Digitalisation of internal operations')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
  });

  it('adds a value', async () => {
    const fetchMock = mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('New goal'), 'Better service');
    await user.click(screen.getByRole('button', { name: 'Add goal' }));
    expect(await screen.findByText('Better service')).toBeInTheDocument();
    expect(screen.getByLabelText('New goal')).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledWith('/api/lists/goal', expect.objectContaining({ method: 'POST' }));
  });

  it('renames a value', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Rename Customer' }));
    const input = screen.getByLabelText('New name for Customer');
    await user.clear(input);
    await user.type(input, 'Customer services');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Customer services')).toBeInTheDocument();
  });

  it('deletes an unused value, and explains why a used one cannot be deleted', async () => {
    mockFetch(fakeServer());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Finance' }));
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Criminal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Criminal" is used by 1 project');
    expect(screen.getByText('Criminal')).toBeInTheDocument();
  });
});
