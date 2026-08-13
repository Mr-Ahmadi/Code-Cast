const DEFAULT_TIMEOUT = 60000;

function normalizeUrl(url) {
  url = (url || 'http://localhost:11434').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export { normalizeUrl };

/**
 * Combines an external abort signal with an internal timeout so a hung Ollama
 * server can never leave a request (and its UI spinner) pending forever.
 */
function withTimeout(signal, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeout);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  };
  return { signal: controller.signal, cleanup };
}

async function postJson(base, path, body, signal, timeout) {
  const { signal: merged, cleanup } = withTimeout(signal, timeout);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: merged,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const text = await res.text();
        detail = text.slice(0, 200);
      } catch { /* body already consumed or unreadable */ }
      throw new Error(`Ollama ${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
    }
    return res;
  } finally {
    cleanup();
  }
}

export async function ollamaCompletion({
  model,
  prompt,
  ollamaUrl,
  signal,
  stop = [],
  temperature = 0.1,
  numPredict = 256,
  timeout = 20000,
  raw = true,
}) {
  const base = normalizeUrl(ollamaUrl);
  const res = await postJson(base, '/api/generate', {
    model,
    prompt,
    stream: false,
    raw,
    options: {
      temperature,
      top_p: 0.9,
      num_predict: numPredict,
      stop,
    },
  }, signal, timeout);

  const data = await res.json();
  return data.response || '';
}

export async function ollamaChat({ model, messages, ollamaUrl, signal, temperature = 0.2, numPredict, timeout = DEFAULT_TIMEOUT }) {
  const base = normalizeUrl(ollamaUrl);
  const res = await postJson(base, '/api/chat', {
    model,
    messages,
    stream: false,
    options: { temperature, ...(numPredict ? { num_predict: numPredict } : {}) },
  }, signal, timeout);

  const data = await res.json();
  return data.message?.content || '';
}

/**
 * Streams a chat completion, invoking onToken with each delta.
 * Resolves with the full concatenated text.
 */
export async function ollamaChatStream({
  model,
  messages,
  ollamaUrl,
  signal,
  temperature = 0.2,
  numPredict,
  timeout = DEFAULT_TIMEOUT,
  onToken,
}) {
  const base = normalizeUrl(ollamaUrl);
  const { signal: merged, cleanup } = withTimeout(signal, timeout);
  let full = '';

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature, ...(numPredict ? { num_predict: numPredict } : {}) },
      }),
      signal: merged,
    });

    if (!res.ok) throw new Error(`Ollama ${res.status} ${res.statusText}`);
    if (!res.body) return ollamaChat({ model, messages, ollamaUrl, signal, temperature, numPredict, timeout });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Ollama emits newline-delimited JSON; the tail may be a partial object.
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let chunk;
        try {
          chunk = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const delta = chunk.message?.content || '';
        if (delta) {
          full += delta;
          onToken?.(delta, full);
        }
        if (chunk.done) return full;
      }
    }
    return full;
  } finally {
    cleanup();
  }
}

export async function ollamaListModels(ollamaUrl, signal) {
  const base = normalizeUrl(ollamaUrl);
  try {
    const { signal: merged, cleanup } = withTimeout(signal, 5000);
    try {
      const res = await fetch(`${base}/api/tags`, { signal: merged });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map(m => m.name).sort();
    } finally {
      cleanup();
    }
  } catch {
    return [];
  }
}

/** Returns { ok, models, error } so settings UI can show a live connection state. */
export async function ollamaHealth(ollamaUrl) {
  const base = normalizeUrl(ollamaUrl);
  try {
    const { signal, cleanup } = withTimeout(null, 4000);
    try {
      const res = await fetch(`${base}/api/tags`, { signal });
      if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, models: (data.models || []).map(m => m.name).sort(), error: null };
    } finally {
      cleanup();
    }
  } catch (err) {
    return { ok: false, models: [], error: err?.message === 'Failed to fetch' ? 'Cannot reach Ollama' : (err?.message || 'Connection failed') };
  }
}
