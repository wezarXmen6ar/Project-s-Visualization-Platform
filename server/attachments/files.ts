import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * File storage for anything uploaded against a resource: project attachments now, person documents from M7 Task 8
 * on. Every function takes the folder to work in, so callers decide the layout (`<attachmentsDir>/<projectId>`,
 * `<attachmentsDir>/people/<resourceId>`, …) — this module knows nothing about projects or people.
 */

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  exe: 'application/x-msdownload',
};

/** Guesses a MIME type from a file name's extension; 'application/octet-stream' when unknown or extension-less. */
export function guessMime(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1 || dot === fileName.length - 1) return 'application/octet-stream';
  const ext = fileName.slice(dot + 1).toLowerCase();
  return EXTENSION_MIME[ext] ?? 'application/octet-stream';
}

/** True for application/pdf and image/*, the types the client can preview inline. */
export function isPreviewable(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/**
 * Strips any path prefix (everything up to the last "/" or "\"), keeps letters (including Arabic), digits, ".",
 * "-", "_" and spaces (turning everything else into "_"), and cuts the result to 100 characters.
 */
export function sanitiseFileName(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  const cleaned = base.replace(/[^\p{L}\p{N}.\-_ ]/gu, '_');
  const cut = cleaned.slice(0, 100);
  return cut.length > 0 ? cut : '_';
}

/** "<uuid>-<sanitised original name>": unique on its own, so two uploads with the same name never collide. */
export function makeStoredName(originalName: string): string {
  return `${randomUUID()}-${sanitiseFileName(originalName)}`;
}

/** Creates `dir` if it is missing, then writes `data` under `storedName`. Never overwrites an existing file. */
export function writeAttachmentFile(dir: string, storedName: string, data: Buffer): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, storedName), data, { flag: 'wx' });
}

export function readAttachmentFile(dir: string, storedName: string): Buffer {
  return readFileSync(join(dir, storedName));
}

/** Used to clean up a file just written when the database insert that should follow it fails. */
export function removeAttachmentFile(dir: string, storedName: string): void {
  unlinkSync(join(dir, storedName));
}

/** Moves `dir/storedName` to `dir/_deleted/storedName`, creating `_deleted` if it is missing. */
export function moveAttachmentFileToDeleted(dir: string, storedName: string): void {
  const deletedDir = join(dir, '_deleted');
  mkdirSync(deletedDir, { recursive: true });
  renameSync(join(dir, storedName), join(deletedDir, storedName));
}
