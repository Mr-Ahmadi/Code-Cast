/**
 * HTTP transport for model servers.
 *
 * In the desktop app requests go through the Electron main process, so a
 * model server never needs CORS configured for the app's origin (LM Studio,
 * llama.cpp and friends reject browser origins by default). In a browser the
 * request is a plain fetch.
 *
 * Every request has an *idle* timeout: it is re-armed whenever a streamed
 * chunk arrives, so a long answer is never cut off while a hung server still
 * fails fast.
 */

let sequence = 0;

function namedError(name, message, cause) {
  const err = new Error(message);
  err.name = name;
  if (cause) err.cause = cause;
  return err;
}

const abortError = () => namedError('AbortError', 'The request was aborted.');

export function isAbortError(err) {
  return err?.name === 'AbortError';
}

/** True when requests are proxied through the desktop app's main process. */
export function hasNativeTransport() {
  return typeof window !== 'undefined' && !!window.electronAPI?.ai?.fetch;
}

function viaFetch(req, { resolve, reject, activity }) {
  const controller = new AbortController();

  (async () => {
    let res;
    try {
      res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
      });
    } catch (err) {
      reject(controller.signal.aborted ? abortError() : namedError('NetworkError', err?.message || 'Network request failed', err));
      return;
    }

    try {
      const meta = { ok: res.ok, status: res.status, statusText: res.statusText };
      if (!res.ok || !req.onChunk || !res.body) {
        const text = await res.text();
        if (res.ok && req.onChunk && text) req.onChunk(text);
        resolve({ ...meta, text: req.onChunk && res.ok ? '' : text });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        activity();
        req.onChunk(decoder.decode(value, { stream: true }));
      }
      const tail = decoder.decode();
      if (tail) req.onChunk(tail);
      resolve({ ...meta, text: '' });
    } catch (err) {
      reject(controller.signal.aborted ? abortError() : namedError('NetworkError', err?.message || 'Connection dropped', err));
    }
  })();

  return () => controller.abort();
}

function viaElectron(req, { resolve, reject, activity }) {
  const id = `ai-${Date.now()}-${++sequence}`;
  const api = window.electronAPI.ai;
  const onChunk = req.onChunk
    ? (chunk) => { activity(); req.onChunk(chunk); }
    : undefined;

  api.fetch(id, {
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    stream: !!req.onChunk,
  }, onChunk)
    .then((res) => {
      if (res?.aborted) reject(abortError());
      else if (res?.error) reject(namedError('NetworkError', res.error));
      else {
        // A server that ignored `stream: true` sends its whole body at once.
        if (res.ok && req.onChunk && res.text) req.onChunk(res.text);
        resolve({ ok: res.ok, status: res.status, statusText: res.statusText, text: req.onChunk && res.ok ? '' : (res.text || '') });
      }
    })
    .catch((err) => reject(namedError('NetworkError', err?.message || 'Request failed', err)));

  return () => { api.abort(id); };
}

/**
 * @param {object} req
 * @param {string} req.url
 * @param {string} [req.method]
 * @param {Record<string,string>} [req.headers]
 * @param {string} [req.body]
 * @param {AbortSignal} [req.signal]
 * @param {number} [req.timeout]  Idle timeout in ms.
 * @param {(chunk: string) => void} [req.onChunk] Streams the body when given;
 *   the resolved `text` is then empty for successful responses.
 * @returns {Promise<{ok:boolean,status:number,statusText:string,text:string}>}
 *   Rejects with AbortError, TimeoutError or NetworkError — never for an HTTP
 *   error status, which the caller inspects.
 */
export function aiRequest({ url, method = 'GET', headers = {}, body, signal, timeout = 60000, onChunk }) {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let cancel = () => {};

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cancel();
        settle(reject, namedError('TimeoutError', `no response for ${Math.round(timeout / 1000)}s`));
      }, timeout);
    };

    function onAbort() {
      cancel();
      settle(reject, abortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    arm();

    const guardedChunk = onChunk
      ? (chunk) => { if (!settled) onChunk(chunk); }
      : undefined;

    const run = hasNativeTransport() ? viaElectron : viaFetch;
    cancel = run(
      { url, method, headers, body, onChunk: guardedChunk },
      {
        resolve: (value) => settle(resolve, value),
        reject: (err) => settle(reject, err),
        activity: () => { if (!settled) arm(); },
      },
    );
  });
}
