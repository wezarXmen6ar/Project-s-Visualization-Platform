import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { join } from 'node:path';
import type { FastifyReply } from 'fastify';

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

/** The types the client can preview inline. SVG is deliberately absent: it can carry a script, so it always downloads. */
const PREVIEWABLE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp']);

/** True for a PDF or a raster image the browser can show inline (compared case-insensitively). */
export function isPreviewable(mime: string): boolean {
  return PREVIEWABLE.has(mime.toLowerCase());
}

/**
 * Strips any path prefix (everything up to the last "/" or "\"), keeps letters (including Arabic), combining marks
 * (Arabic diacritics such as a shadda), digits, ".", "-", "_" and spaces (turning everything else into "_"), strips
 * trailing dots and spaces (Windows can't keep a file ending in either), and cuts the result to 100 characters.
 */
export function sanitiseFileName(name: string): string {
  const base = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  const cleaned = base.replace(/[^\p{L}\p{M}\p{N}.\-_ ]/gu, '_');
  const cut = cleaned.slice(0, 100).replace(/[. ]+$/, '');
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

/**
 * Moves `dir/storedName` to `deletedDir/storedName`, creating `deletedDir` if it is missing. `deletedDir` is the
 * caller's choice (one shared `_deleted` root, not one per folder), so every kind of resource's files end up in the
 * same place.
 */
export function moveAttachmentFileToDeleted(dir: string, storedName: string, deletedDir: string): void {
  mkdirSync(deletedDir, { recursive: true });
  renameSync(join(dir, storedName), join(deletedDir, storedName));
}

export interface UploadHeaders {
  originalName: string;
  mime: string;
}

/**
 * Reads an upload's X-File-Name (percent-decoded, so an Arabic name round-trips) and X-File-Type headers, shared by
 * the attachments and person-documents upload routes. Returns undefined when X-File-Name is present but isn't valid
 * percent-encoding, which the caller turns into a 400 `error.badFileName`.
 */
export function parseUploadHeaders(headers: IncomingHttpHeaders): UploadHeaders | undefined {
  const rawName = headers['x-file-name'];
  let originalName: string;
  try {
    originalName = rawName ? decodeURIComponent(String(rawName)) : 'file';
  } catch {
    return undefined;
  }
  const rawType = headers['x-file-type'];
  // A client-declared MIME type is only trusted when it looks like one; anything else falls back to a guess from
  // the extension, same as when the header is absent.
  const mime = typeof rawType === 'string' && rawType.length <= 100 && /^[\w.+-]+\/[\w.+-]+$/.test(rawType)
    ? rawType.toLowerCase()
    : guessMime(originalName);
  return { originalName, mime };
}

/** Percent-encodes for RFC 5987's `filename*`: `encodeURIComponent` plus the few extra characters it leaves as-is. */
function encodeFilenameStar(name: string): string {
  return encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export interface StoredFileMeta {
  originalName: string;
  mime: string;
}

/**
 * Sends a downloaded or previewed file: `X-Content-Type-Options: nosniff`, a locked-down CSP (SVG can carry a
 * script, so even a plain download stays sandboxed; a PDF skips `sandbox`, which some browsers' own PDF viewer
 * refuses to run under — it already runs any PDF script in its own sandbox, never on the app's origin), and an RFC
 * 5987 `Content-Disposition` so an Arabic file name survives. Shared by the attachments and person-documents file
 * routes.
 */
export function sendStoredFile(reply: FastifyReply, data: Buffer, file: StoredFileMeta, inline: boolean) {
  const encoded = encodeFilenameStar(file.originalName);
  reply.header('X-Content-Type-Options', 'nosniff');
  const sandbox = file.mime.toLowerCase() === 'application/pdf' ? '' : '; sandbox';
  reply.header('Content-Security-Policy', `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'${sandbox}`);
  reply.header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encoded}`);
  return reply.type(file.mime).send(data);
}
