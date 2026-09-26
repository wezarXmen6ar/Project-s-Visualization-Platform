// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleAttachments, sampleProject } from '../../testing/mockFetch';
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
