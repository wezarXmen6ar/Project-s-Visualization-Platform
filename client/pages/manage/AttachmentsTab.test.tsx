// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, sampleAttachments, sampleEntries, sampleProject } from '../../testing/mockFetch';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { installMockXhr } from '../../testing/mockXhr';
import { AttachmentsTab } from './AttachmentsTab';

const TYPES = [
  { id: 100, list: 'attachmentType' as const, name: 'Meeting Minutes', order: 0, nameAr: 'محضر اجتماع' },
  { id: 101, list: 'attachmentType' as const, name: 'Approval', order: 1, nameAr: 'اعتماد' },
  { id: 109, list: 'attachmentType' as const, name: 'Other', order: 9, nameAr: 'أخرى' },
];

function renderTab(onOpenHistory = vi.fn()) {
  return render(<AttachmentsTab project={sampleProject()} attachmentTypes={TYPES} onOpenHistory={onOpenHistory} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AttachmentsTab', () => {
  it('shows "No files yet." with no attachments', async () => {
    installMockXhr();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderTab();
    expect(await screen.findByText('No files yet.')).toBeInTheDocument();
  });

  it('lists attachments, and the table filters by type', async () => {
    installMockXhr();
    const all = sampleAttachments();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = url.includes('typeId=101') ? all.filter((a) => a.type?.id === 101) : all;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderTab();

    expect(await screen.findByText('Approval letter.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.docx')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by type'), 'Approval');
    expect(await screen.findByText('Approval letter.pdf')).toBeInTheDocument();
    expect(screen.queryByText('notes.docx')).not.toBeInTheDocument();
  });

  it('opens the upload row, uploads a file with the chosen type and phase, and shows it once done', async () => {
    const { requests } = installMockXhr();
    let attachments = [] as ReturnType<typeof sampleAttachments>;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(attachments), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('No files yet.');
    await user.click(screen.getByRole('button', { name: 'Upload file' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'Approval');
    await user.selectOptions(screen.getByLabelText('Phase'), 'Development');

    const input = screen.getByLabelText('Upload file', { selector: 'input' });
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    await user.upload(input, file);

    expect(requests[0].url).toContain('typeId=101');
    expect(requests[0].url).toContain('phaseId=12');
    const uploaded = sampleAttachments()[0];
    attachments = [uploaded];
    requests[0].respond(201, uploaded);
    expect(await screen.findByText('Approval letter.pdf')).toBeInTheDocument();
  });

  it('deletes a file after confirming', async () => {
    installMockXhr();
    let attachments = sampleAttachments();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'DELETE') {
        attachments = attachments.filter((a) => a.id !== 400);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(attachments), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Approval letter.pdf');
    await user.click(screen.getByRole('button', { name: 'Delete Approval letter.pdf' }));
    expect(await screen.findByText(/Delete this file\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/attachments/400', expect.objectContaining({ method: 'DELETE' }));
  });

  it('preview opens a dialog with an iframe whose src ends with ?inline=1, and Escape closes it', async () => {
    installMockXhr();
    const attachments = sampleAttachments();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(attachments), { status: 200 })));
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Approval letter.pdf');
    await user.click(screen.getByRole('button', { name: 'Preview Approval letter.pdf' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('iframe')?.getAttribute('src')).toBe('/api/attachments/400/file?inline=1');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dragging a file onto the tab shows a drop hint, and dropping opens the upload row and uploads it', async () => {
    const { requests } = installMockXhr();
    let attachments = [] as ReturnType<typeof sampleAttachments>;
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(attachments), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    await screen.findByText('No files yet.');
    const card = document.querySelector('.card') as HTMLElement;
    const file = new File(['x'], 'dropped.pdf', { type: 'application/pdf' });
    const dataTransfer = { files: [file] };

    fireEvent.dragOver(card, { dataTransfer });
    expect(screen.getByText('Drop files here to upload')).toBeInTheDocument();

    fireEvent.drop(card, { dataTransfer });
    expect(screen.queryByText('Drop files here to upload')).not.toBeInTheDocument();

    expect(requests).toHaveLength(1);
    expect(requests[0].headers['X-File-Name']).toBe(encodeURIComponent('dropped.pdf'));
    const uploaded = sampleAttachments()[0];
    attachments = [uploaded];
    requests[0].respond(201, uploaded);
    expect(await screen.findByText('Approval letter.pdf')).toBeInTheDocument();
  });

  it('the "From" column shows the entry\'s title and date, and opens History on it', async () => {
    const onOpenHistory = vi.fn();
    mockFetch({
      'GET /api/projects/1/attachments': () => ({ body: sampleAttachments() }),
      'GET /api/projects/1/entries': () => ({ body: sampleEntries() }),
    });
    const user = userEvent.setup();
    render(<AttachmentsTab project={sampleProject()} attachmentTypes={TYPES} onOpenHistory={onOpenHistory} />);

    const link = await screen.findByRole('button', { name: 'Kickoff · 24 Sep' });
    await user.click(link);
    expect(onOpenHistory).toHaveBeenCalledWith(300);
  });

  it('falls back to a plain "View in History" link when the entry cannot be found', async () => {
    mockFetch({
      'GET /api/projects/1/attachments': () => ({ body: sampleAttachments() }),
      'GET /api/projects/1/entries': () => ({ body: [] }),
    });
    render(<AttachmentsTab project={sampleProject()} attachmentTypes={TYPES} onOpenHistory={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'View in History' })).toBeInTheDocument();
  });

  function sortableAttachments() {
    return [
      {
        id: 1, projectId: 1, phase: { id: 12, name: 'Development', phaseName: 'Development', subPhaseName: null },
        entryId: null, type: { id: 101, name: 'Approval', nameAr: 'اعتماد' }, name: 'B.pdf', mime: 'application/pdf',
        size: 500, documentDate: '2026-09-10', uploadedAt: '2026-09-21T09:00:00.000Z', previewable: true,
      },
      {
        id: 2, projectId: 1, phase: null, entryId: null, type: null, name: 'A.pdf', mime: 'application/pdf',
        size: 100, documentDate: null, uploadedAt: '2026-09-22T09:00:00.000Z', previewable: true,
      },
      {
        id: 3, projectId: 1, phase: { id: 11, name: 'Requirements', phaseName: 'Requirements', subPhaseName: null },
        entryId: null, type: { id: 109, name: 'Other', nameAr: 'أخرى' }, name: 'C.pdf', mime: 'application/pdf',
        size: 300, documentDate: '2026-09-05', uploadedAt: '2026-09-20T09:00:00.000Z', previewable: true,
      },
    ];
  }

  function namesInOrder() {
    return Array.from(document.querySelectorAll('td[data-col="name"] span[data-user-content]')).map((el) => el.textContent);
  }

  describe('sorting', () => {
    it('sorts by size ascending, then descending, when the Size header is clicked', async () => {
      mockFetch({ 'GET /api/projects/1/attachments': () => ({ body: sortableAttachments() }) });
      const user = userEvent.setup();
      renderTab();

      await screen.findByText('B.pdf');
      const sizeHeader = screen.getByRole('columnheader', { name: /Size/ });
      await user.click(within(sizeHeader).getByRole('button'));
      expect(namesInOrder()).toEqual(['A.pdf', 'C.pdf', 'B.pdf']);
      expect(sizeHeader).toHaveAttribute('aria-sort', 'ascending');

      await user.click(within(sizeHeader).getByRole('button'));
      expect(namesInOrder()).toEqual(['B.pdf', 'C.pdf', 'A.pdf']);
      expect(sizeHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('sorts by phase, with the attachment that has none sorting last in both directions', async () => {
      mockFetch({ 'GET /api/projects/1/attachments': () => ({ body: sortableAttachments() }) });
      const user = userEvent.setup();
      renderTab();

      await screen.findByText('B.pdf');
      const phaseHeader = screen.getByRole('columnheader', { name: /Phase/ });
      await user.click(within(phaseHeader).getByRole('button'));
      expect(namesInOrder()).toEqual(['B.pdf', 'C.pdf', 'A.pdf']); // Development, Requirements, (none)

      await user.click(within(phaseHeader).getByRole('button'));
      expect(namesInOrder()).toEqual(['C.pdf', 'B.pdf', 'A.pdf']); // Requirements, Development, (none)
    });

    it('offers a "Sort by" select for the phone layout, which sorts the same way as the headers', async () => {
      mockFetch({ 'GET /api/projects/1/attachments': () => ({ body: sortableAttachments() }) });
      const user = userEvent.setup();
      renderTab();

      await screen.findByText('B.pdf');
      await user.selectOptions(screen.getByLabelText('Sort by'), 'Size');
      expect(namesInOrder()).toEqual(['A.pdf', 'C.pdf', 'B.pdf']);

      await user.click(screen.getByRole('button', { name: 'Reverse sort order' }));
      expect(namesInOrder()).toEqual(['B.pdf', 'C.pdf', 'A.pdf']);
    });
  });

  describe('Key dates (M7 Task 9)', () => {
    const TYPES_WITH_CONTRACT = [...TYPES, { id: 108, list: 'attachmentType' as const, name: 'Contract', order: 8, nameAr: 'العقد' }];
    const KEY_DATE_TYPES = [
      { id: 320, list: 'keyDateType' as const, name: 'Contract end', order: 0, nameAr: 'انتهاء العقد' },
      { id: 321, list: 'keyDateType' as const, name: 'License expiry', order: 1, nameAr: 'انتهاء الترخيص' },
    ];

    it('opens the Key dates section for a Contract, and saves its key dates atomically, linked to the uploaded file', async () => {
      const { requests } = installMockXhr();
      const created = {
        id: 500, projectId: 1, phase: null, entryId: null, type: { id: 108, name: 'Contract', nameAr: 'العقد' }, name: 'contract.pdf',
        mime: 'application/pdf', size: 10, documentDate: null, uploadedAt: '2026-09-26T09:00:00.000Z', previewable: true,
      };
      const replacePuts: { url: string; body: { date: string }[] }[] = [];
      mockFetch({
        'GET /api/projects/1/attachments': () => ({ body: [] }),
        'GET /api/projects/1/entries': () => ({ body: [] }),
        'GET /api/projects/1/key-dates': () => ({ body: [] }),
        'PUT /api/attachments/500/key-dates': (init) => {
          const body = JSON.parse(init!.body as string) as { date: string }[];
          replacePuts.push({ url: '/api/attachments/500/key-dates', body });
          return { status: 200, body: body.map((r, i) => ({ id: 900 + i, projectId: 1, type: null, date: r.date, note: null, attachment: { id: 500, name: 'contract.pdf', mime: 'application/pdf', previewable: true }, createdAt: 'x', state: 'soon' })) };
        },
      });
      const user = userEvent.setup();
      render(
        <AttachmentsTab
          project={sampleProject()} attachmentTypes={TYPES_WITH_CONTRACT} keyDateTypes={KEY_DATE_TYPES} onOpenHistory={vi.fn()}
        />,
      );
      await screen.findByText('No files yet.');
      await user.click(screen.getByRole('button', { name: 'Upload file' }));
      await user.selectOptions(screen.getByLabelText('Type'), 'Contract');

      // The Key dates section is open by default for a Contract, with one row already offered.
      const dateInputs = screen.getAllByLabelText('Date');
      expect(dateInputs).toHaveLength(1);
      fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } });

      const input = screen.getByLabelText('Upload file', { selector: 'input' });
      const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
      await user.upload(input, file);
      requests[0].respond(201, created);

      await waitFor(() => expect(replacePuts).toHaveLength(1));
      expect(replacePuts[0].body).toMatchObject([{ date: '2026-12-01' }]);
    });

    it('keeps the typed key dates and shows Retry when saving them fails after the upload; Retry succeeds and clears them', async () => {
      const { requests } = installMockXhr();
      const created = {
        id: 500, projectId: 1, phase: null, entryId: null, type: { id: 108, name: 'Contract', nameAr: 'العقد' }, name: 'contract.pdf',
        mime: 'application/pdf', size: 10, documentDate: null, uploadedAt: '2026-09-26T09:00:00.000Z', previewable: true,
      };
      let fail = true;
      mockFetch({
        'GET /api/projects/1/attachments': () => ({ body: [] }),
        'GET /api/projects/1/entries': () => ({ body: [] }),
        'GET /api/projects/1/key-dates': () => ({ body: [] }),
        'PUT /api/attachments/500/key-dates': (init) => {
          if (fail) {
            fail = false;
            return { status: 500, body: { error: 'Server error' } };
          }
          const body = JSON.parse(init!.body as string) as { date: string }[];
          return { status: 200, body: body.map((r, i) => ({ id: 900 + i, projectId: 1, type: null, date: r.date, note: null, attachment: { id: 500, name: 'contract.pdf', mime: 'application/pdf', previewable: true }, createdAt: 'x', state: 'soon' })) };
        },
      });
      const user = userEvent.setup();
      render(
        <AttachmentsTab
          project={sampleProject()} attachmentTypes={TYPES_WITH_CONTRACT} keyDateTypes={KEY_DATE_TYPES} onOpenHistory={vi.fn()}
        />,
      );
      await screen.findByText('No files yet.');
      await user.click(screen.getByRole('button', { name: 'Upload file' }));
      await user.selectOptions(screen.getByLabelText('Type'), 'Contract');
      fireEvent.change(screen.getAllByLabelText('Date')[0], { target: { value: '2026-12-01' } });

      const input = screen.getByLabelText('Upload file', { selector: 'input' });
      const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
      await user.upload(input, file);
      requests[0].respond(201, created);

      const retryButton = await screen.findByRole('button', { name: 'Retry' });
      // The typed row is kept, and the section stays open, rather than being silently lost.
      expect(screen.getByDisplayValue('2026-12-01')).toBeInTheDocument();

      await user.click(retryButton);
      await waitFor(() => expect(screen.queryByDisplayValue('2026-12-01')).not.toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('leaves the Key dates section collapsed for a non-Contract type', async () => {
      mockFetch({
        'GET /api/projects/1/attachments': () => ({ body: [] }),
        'GET /api/projects/1/entries': () => ({ body: [] }),
        'GET /api/projects/1/key-dates': () => ({ body: [] }),
      });
      const user = userEvent.setup();
      render(
        <AttachmentsTab
          project={sampleProject()} attachmentTypes={TYPES_WITH_CONTRACT} keyDateTypes={KEY_DATE_TYPES} onOpenHistory={vi.fn()}
        />,
      );
      await screen.findByText('No files yet.');
      await user.click(screen.getByRole('button', { name: 'Upload file' }));
      await user.selectOptions(screen.getByLabelText('Type'), 'Approval');
      expect(screen.queryByLabelText('Date')).toBeNull();
      expect(screen.getByRole('button', { name: 'Key dates' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('accepts only one file while the Key dates section has rows, with a hint, and allows several again once cleared', async () => {
      mockFetch({
        'GET /api/projects/1/attachments': () => ({ body: [] }),
        'GET /api/projects/1/entries': () => ({ body: [] }),
        'GET /api/projects/1/key-dates': () => ({ body: [] }),
      });
      const user = userEvent.setup();
      render(
        <AttachmentsTab
          project={sampleProject()} attachmentTypes={TYPES_WITH_CONTRACT} keyDateTypes={KEY_DATE_TYPES} onOpenHistory={vi.fn()}
        />,
      );
      await screen.findByText('No files yet.');
      await user.click(screen.getByRole('button', { name: 'Upload file' }));

      // No Contract chosen yet, so no key date rows: several files are still allowed.
      expect(screen.getByLabelText('Upload file', { selector: 'input' })).toHaveAttribute('multiple');
      expect(screen.queryByText('Key dates attach to one contract file at a time.')).toBeNull();

      await user.selectOptions(screen.getByLabelText('Type'), 'Contract');
      expect(screen.getByLabelText('Upload file', { selector: 'input' })).not.toHaveAttribute('multiple');
      expect(screen.getByText('Key dates attach to one contract file at a time.')).toBeInTheDocument();
    });

    it('keeps a key date typed after picking the file but before the upload resolves (M7 stale-callback fix)', async () => {
      const { requests } = installMockXhr();
      const created = {
        id: 500, projectId: 1, phase: null, entryId: null, type: { id: 108, name: 'Contract', nameAr: 'العقد' }, name: 'contract.pdf',
        mime: 'application/pdf', size: 10, documentDate: null, uploadedAt: '2026-09-26T09:00:00.000Z', previewable: true,
      };
      const replacePuts: { date: string }[][] = [];
      mockFetch({
        'GET /api/projects/1/attachments': () => ({ body: [] }),
        'GET /api/projects/1/entries': () => ({ body: [] }),
        'GET /api/projects/1/key-dates': () => ({ body: [] }),
        'PUT /api/attachments/500/key-dates': (init) => {
          const body = JSON.parse(init!.body as string) as { date: string }[];
          replacePuts.push(body);
          return { status: 200, body: body.map((r, i) => ({ id: 900 + i, projectId: 1, type: null, date: r.date, note: null, attachment: { id: 500, name: 'contract.pdf', mime: 'application/pdf', previewable: true }, createdAt: 'x', state: 'soon' })) };
        },
      });
      const user = userEvent.setup();
      render(
        <AttachmentsTab
          project={sampleProject()} attachmentTypes={TYPES_WITH_CONTRACT} keyDateTypes={KEY_DATE_TYPES} onOpenHistory={vi.fn()}
        />,
      );
      await screen.findByText('No files yet.');
      await user.click(screen.getByRole('button', { name: 'Upload file' }));
      await user.selectOptions(screen.getByLabelText('Type'), 'Contract');

      // Pick the file first (starts the upload, not yet resolved) …
      const input = screen.getByLabelText('Upload file', { selector: 'input' });
      const file = new File(['x'], 'contract.pdf', { type: 'application/pdf' });
      await user.upload(input, file);

      // … then, before the upload's response arrives, type the key date.
      const dateInputs = screen.getAllByLabelText('Date');
      fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } });

      // Now the upload resolves.
      requests[0].respond(201, created);

      await waitFor(() => expect(replacePuts).toHaveLength(1));
      expect(replacePuts[0]).toMatchObject([{ date: '2026-12-01' }]);
    });

    it('editing a Contract shows and edits its own key dates', async () => {
      const attachment = {
        id: 400, projectId: 1, phase: null, entryId: null, type: { id: 108, name: 'Contract', nameAr: 'العقد' }, name: 'contract.pdf',
        mime: 'application/pdf', size: 10, documentDate: null, uploadedAt: '2026-09-20T09:00:00.000Z', previewable: true,
      };
      const keyDate = {
        id: 900, projectId: 1, type: { id: 321, name: 'License expiry', nameAr: 'انتهاء الترخيص' }, date: '2026-12-01',
        note: 'Renew early', attachment: { id: 400, name: 'contract.pdf', mime: 'application/pdf', previewable: true },
        createdAt: 'x', state: 'soon',
      };
      mockFetch({
        'GET /api/projects/1/attachments': () => ({ body: [attachment] }),
        'GET /api/projects/1/entries': () => ({ body: [] }),
        'GET /api/projects/1/key-dates': () => ({ body: [keyDate] }),
      });
      const user = userEvent.setup();
      render(
        <AttachmentsTab
          project={sampleProject()} attachmentTypes={TYPES_WITH_CONTRACT} keyDateTypes={KEY_DATE_TYPES} onOpenHistory={vi.fn()}
        />,
      );
      await screen.findByText('contract.pdf');
      await user.click(screen.getByRole('button', { name: 'Edit contract.pdf' }));
      expect(screen.getByDisplayValue('2026-12-01')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Renew early')).toBeInTheDocument();
      const typeSelects = screen.getAllByLabelText('Type', { selector: 'select' });
      expect(typeSelects.some((el) => (el as HTMLSelectElement).value === '321')).toBe(true);
    });
  });

  it('renders the tab in Arabic', async () => {
    installMockXhr();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(sampleAttachments()), { status: 200 })));
    render(
      <LanguageProvider lang="ar">
        <AttachmentsTab project={sampleProject()} attachmentTypes={TYPES} onOpenHistory={vi.fn()} />
      </LanguageProvider>,
    );
    expect(await screen.findByText('محضر اجتماع')).toBeInTheDocument();
  });
});
