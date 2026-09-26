// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentRecord } from '../../shared/types';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { FilePreview } from './FilePreview';

function pdf(overrides: Partial<AttachmentRecord> = {}): AttachmentRecord {
  return {
    id: 400, projectId: 1, phase: null, entryId: null, type: null, name: 'report.pdf', mime: 'application/pdf',
    size: 1000, documentDate: null, uploadedAt: '2026-09-24T10:00:00.000Z', previewable: true, ...overrides,
  };
}

describe('FilePreview', () => {
  it('opens a dialog with an iframe whose src ends with ?inline=1, and shows the name and Download', () => {
    render(<FilePreview attachment={pdf()} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    const iframe = dialog.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('/api/attachments/400/file?inline=1');
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/api/attachments/400/file');
  });

  it('shows an image for an image mime type', () => {
    render(<FilePreview attachment={pdf({ id: 401, name: 'photo.png', mime: 'image/png' })} onClose={vi.fn()} />);
    const img = screen.getByRole('dialog').querySelector('img');
    expect(img?.getAttribute('src')).toBe('/api/attachments/401/file?inline=1');
  });

  it('Escape closes it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FilePreview attachment={pdf()} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the element that opened it, on close', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const { unmount } = render(<FilePreview attachment={pdf()} onClose={vi.fn()} returnFocusTo={button} />);
    expect(document.activeElement).not.toBe(button);
    unmount();
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it('traps Tab focus inside the dialog: it wraps from the last focusable element back to the first, and back', () => {
    render(<FilePreview attachment={pdf()} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], iframe'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('renders in Arabic', () => {
    render(
      <LanguageProvider lang="ar">
        <FilePreview attachment={pdf()} onClose={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByRole('link', { name: 'تنزيل' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إغلاق المعاينة' })).toBeInTheDocument();
  });
});
