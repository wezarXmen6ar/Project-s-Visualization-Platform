// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentRecord } from '../../shared/types';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { installMockXhr } from '../testing/mockXhr';
import { Uploader } from './Uploader';

function record(overrides: Partial<AttachmentRecord> = {}): AttachmentRecord {
  return {
    id: 500, projectId: 1, phase: null, entryId: null, type: null, name: 'a.pdf', mime: 'application/pdf',
    size: 1000, documentDate: null, uploadedAt: '2026-09-24T10:00:00.000Z', previewable: true, ...overrides,
  };
}

function file(name: string, content = 'x'.repeat(10)) {
  return new File([content], name, { type: 'application/pdf' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Uploader', () => {
  it('uploading two files sends two requests, with X-File-Name encoded and the query holding the type and phase', async () => {
    const { requests } = installMockXhr();
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    render(<Uploader projectId={1} typeId={7} phaseId={12} buttonLabel="Attach files" onUploaded={onUploaded} />);

    const input = screen.getByLabelText('Attach files');
    await user.upload(input, [file('a.pdf'), file('محضر.pdf')]);

    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe('/api/projects/1/attachments?typeId=7&phaseId=12');
    expect(requests[0].headers['X-File-Name']).toBe(encodeURIComponent('a.pdf'));
    expect(decodeURIComponent(requests[1].headers['X-File-Name'])).toBe('محضر.pdf');

    requests[0].respond(201, record({ id: 501, name: 'a.pdf' }));
    requests[1].respond(201, record({ id: 502, name: 'محضر.pdf' }));
    await screen.findByText('محضر.pdf');
    expect(onUploaded).toHaveBeenCalledTimes(2);
    expect(onUploaded.mock.calls.map((c) => c[0].id)).toEqual([501, 502]);
  });

  it('shows a progress bar while uploading', async () => {
    const { requests } = installMockXhr();
    const user = userEvent.setup();
    render(<Uploader projectId={1} buttonLabel="Attach files" onUploaded={vi.fn()} />);
    await user.upload(screen.getByLabelText('Attach files'), file('a.pdf'));

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('value', '0');
    act(() => requests[0].progress(5, 10));
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '50');
  });

  it('a failure on the second file shows Retry for it only, and Retry resends it', async () => {
    const { requests } = installMockXhr();
    const onUploaded = vi.fn();
    const onBusyChange = vi.fn();
    const user = userEvent.setup();
    render(<Uploader projectId={1} buttonLabel="Attach files" onUploaded={onUploaded} onBusyChange={onBusyChange} />);
    await user.upload(screen.getByLabelText('Attach files'), [file('a.pdf'), file('b.pdf')]);

    requests[0].respond(201, record({ id: 501, name: 'a.pdf' }));
    requests[1].respond(500, { error: 'Something went wrong' });
    await screen.findByRole('alert');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(requests).toHaveLength(3);
    expect(requests[2].headers['X-File-Name']).toBe(encodeURIComponent('b.pdf'));
    requests[2].respond(201, record({ id: 503, name: 'b.pdf' }));
    await screen.findByText('b.pdf');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(onUploaded.mock.calls.map((c) => c[0].id)).toEqual([501, 503]);
  });

  it('renders in Arabic', async () => {
    installMockXhr();
    render(
      <LanguageProvider lang="ar">
        <Uploader projectId={1} buttonLabel="إرفاق ملفات" onUploaded={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('button', { name: 'إرفاق ملفات' })).toBeInTheDocument();
  });
});
