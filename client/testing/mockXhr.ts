import { vi } from 'vitest';

/** One recorded `XMLHttpRequest.send()` call, with the means to resolve it as the fake server. */
export interface FakeXhrRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** Fires `onload` with a JSON body, as a real response would arrive. */
  respond(status: number, body: unknown): void;
  /** Fires an upload progress event. */
  progress(loaded: number, total: number): void;
  /** Fires `onerror`, as a genuine network failure (offline, connection reset) would. */
  error(): void;
}

/**
 * Stubs `XMLHttpRequest` with a small fake that records every request `send()` makes, so a test can fire progress,
 * `onload` and `onerror` for it deliberately. `api.uploadAttachment` builds and sends the request synchronously, so
 * `requests` holds the new entry the moment the code under test calls it.
 */
export function installMockXhr(): { requests: FakeXhrRequest[] } {
  const requests: FakeXhrRequest[] = [];

  class FakeXHR {
    method = '';
    url = '';
    headers: Record<string, string> = {};
    upload: { onprogress: ((e: { loaded: number; total: number }) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    responseText = '';

    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(key: string, value: string) {
      this.headers[key] = value;
    }

    send(body: unknown) {
      const self = this;
      requests.push({
        method: self.method,
        url: self.url,
        headers: self.headers,
        body,
        respond(status, respBody) {
          self.status = status;
          self.responseText = JSON.stringify(respBody);
          self.onload?.();
        },
        progress(loaded, total) {
          self.upload.onprogress?.({ loaded, total });
        },
        error() {
          self.onerror?.();
        },
      });
    }
  }

  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  return { requests };
}
