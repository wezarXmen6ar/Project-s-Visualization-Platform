// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ListValue } from '../../../shared/types';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { mockFetch } from '../../testing/mockFetch';
import { ListEditor } from './ListEditor';

const development: ListValue = { id: 9, list: 'phase', name: 'Development', nameAr: 'التطوير', order: 0 };

describe('ListEditor', () => {
  it('shows the value\'s display name, not its English name, in the "in use" error, in Arabic', async () => {
    mockFetch({
      'DELETE /api/lists/phase/9': () => ({
        status: 409,
        body: {
          error: '"Development" is used by 2 projects',
          code: 'error.listValueInUseProjects',
          params: { name: 'Development', count: 2 },
        },
      }),
    });
    const user = userEvent.setup();
    render(
      <LanguageProvider lang="ar">
        <ListEditor title="المراحل" singular="مرحلة" list="phase" values={[development]} onChanged={() => {}} />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'حذف التطوير' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('التطوير');
    expect(alert).not.toHaveTextContent('Development');
  });

  it('shows the plain English "in use" error in English (unchanged)', async () => {
    mockFetch({
      'DELETE /api/lists/phase/9': () => ({
        status: 409,
        body: {
          error: '"Development" is used by 2 projects',
          code: 'error.listValueInUseProjects',
          params: { name: 'Development', count: 2 },
        },
      }),
    });
    const user = userEvent.setup();
    render(
      <LanguageProvider lang="en">
        <ListEditor title="Phases" singular="Phase" list="phase" values={[development]} onChanged={() => {}} />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete Development' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Development" is used by 2 projects');
  });
});
