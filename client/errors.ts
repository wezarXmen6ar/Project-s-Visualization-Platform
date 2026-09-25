import { ApiError } from './api';

/** The server's field messages when there are any, otherwise the error's own message. */
export function messagesOf(err: unknown): string[] {
  if (err instanceof ApiError && err.issues.length > 0) return err.issues.map((i) => i.message);
  return [err instanceof Error ? err.message : String(err)];
}
