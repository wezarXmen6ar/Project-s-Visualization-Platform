// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ListValue, PersonDocumentRecord } from '../../../shared/types';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { mockFetch, type MockHandler } from '../../testing/mockFetch';
import { installMockXhr } from '../../testing/mockXhr';
import { PersonDocuments } from './PersonDocuments';

afterEach(() => {
  vi.unstubAllGlobals();
});

const TYPES: ListValue[] = [
  { id: 300, list: 'personDocumentType', name: 'Passport', nameAr: 'جواز السفر', order: 0 },
  { id: 301, list: 'personDocumentType', name: 'NDA', nameAr: 'وثيقة عدم الإفصاح', order: 1 },
];

function doc(overrides: Partial<PersonDocumentRecord> & Pick<PersonDocumentRecord, 'id'>): PersonDocumentRecord {
  return {
    resourceId: 71, personName: 'Fatima Noor', type: { id: 300, name: 'Passport', nameAr: 'جواز السفر' },
    name: 'passport.pdf', mime: 'application/pdf', size: 200_000, expiryDate: null, note: null,
    uploadedAt: '2026-09-20T09:00:00.000Z', previewable: true, state: null,
    ...overrides,
  };
}

function routes(documents: PersonDocumentRecord[]): Record<string, MockHandler> {
  return { 'GET /api/resources/71/documents': () => ({ body: documents }) };
}

describe('PersonDocuments', () => {
  it('shows an expired document in red and a soon one in amber, with the day count', async () => {
    mockFetch(routes([
      doc({ id: 1, name: 'expired.pdf', expiryDate: '2026-09-01', state: 'expired' }),
      doc({ id: 2, name: 'soon.pdf', expiryDate: '2026-10-19', state: 'soon' }),
    ]));
    render(<PersonDocuments resourceId={71} documentTypes={TYPES} today="2026-10-07" />);

    const expiredCell = (await screen.findByText('Expired')).closest('td')!;
    expect(expiredCell).toHaveClass('expiry-expired');

    const soonCell = (await screen.findByText('Expires in 12 days')).closest('td')!;
    expect(soonCell).toHaveClass('expiry-soon');
  });

  it('shows the Arabic day plural for a soon document', async () => {
    mockFetch(routes([doc({ id: 2, name: 'soon.pdf', expiryDate: '2026-10-19', state: 'soon' })]));
    render(
      <LanguageProvider lang="ar">
        <PersonDocuments resourceId={71} documentTypes={TYPES} today="2026-10-07" />
      </LanguageProvider>,
    );
    expect(await screen.findByText('تنتهي خلال 12 يوماً')).toBeInTheDocument();
  });

  it('uploads a document with a type, expiry date and note', async () => {
    let documents: PersonDocumentRecord[] = [];
    mockFetch({ 'GET /api/resources/71/documents': () => ({ body: documents }) });
    const { requests } = installMockXhr();
    const user = userEvent.setup();
    render(<PersonDocuments resourceId={71} documentTypes={TYPES} today="2026-10-07" />);
    await user.click(await screen.findByRole('button', { name: 'Upload document' }));
    await user.selectOptions(screen.getByLabelText('Type'), 'Passport');
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2027-01-01');
    await user.type(screen.getByLabelText('Note'), 'Renew soon');

    const fileInput = screen.getByLabelText('Upload document', { selector: 'input' }) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'passport.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, file);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('/api/resources/71/documents?typeId=300&expiryDate=2027-01-01&note=Renew+soon');
    const uploaded = doc({ id: 5, name: 'passport.pdf', expiryDate: '2027-01-01', note: 'Renew soon', state: 'fine' });
    documents = [uploaded];
    requests[0].respond(201, uploaded);
    expect(await screen.findByText('passport.pdf')).toBeInTheDocument();
  });

  it('shows no documents yet when there are none', async () => {
    mockFetch(routes([]));
    render(<PersonDocuments resourceId={71} documentTypes={TYPES} today="2026-10-07" />);
    expect(await screen.findByText('No documents yet.')).toBeInTheDocument();
  });

  it('deletes a document after confirming', async () => {
    const fetchMock = mockFetch({
      ...routes([doc({ id: 1, name: 'expired.pdf' })]),
      'DELETE /api/person-documents/1': () => ({ status: 204, body: null }),
    });
    const user = userEvent.setup();
    render(<PersonDocuments resourceId={71} documentTypes={TYPES} today="2026-10-07" />);
    await screen.findByText('expired.pdf');
    await user.click(screen.getByRole('button', { name: 'Delete expired.pdf' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/person-documents/1' && init?.method === 'DELETE')).toBe(true);
  });
});
