/**
 * Provider-agnostic access to language models.
 *
 * Two wire protocols cover every supported backend:
 *  - `ollama` — Ollama's native API (/api/chat, /api/generate, /api/tags)
 *  - `openai` — the OpenAI-compatible API spoken by LM Studio, llama.cpp,
 *               Jan, vLLM, LocalAI, text-generation-webui, OpenRouter, Groq
 *               and OpenAI itself
 *
 * Features never talk HTTP directly: they resolve a provider from settings and
 * call `chat`, `complete` or `listModels`, which turn failures into messages a
 * user can act on ("run `ollama pull …`", "start the LM Studio server").
 */

import { aiRequest, hasNativeTransport, isAbortError } from './aiTransport';
import { supportsFim } from './fim';

export { isAbortError };

export const PROVIDERS = {
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    kind: 'ollama',
    defaultUrl: 'http://localhost:11434',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio',
    kind: 'openai',
    defaultUrl: 'http://localhost:1234/v1',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI-compatible',
    kind: 'openai',
    defaultUrl: '',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

/** One-click base URLs for the generic OpenAI-compatible provider. */
export const OPENAI_COMPATIBLE_PRESETS = [
  { label: 'llama.cpp server / LocalAI', url: 'http://localhost:8080/v1' },
  { label: 'Jan', url: 'http://localhost:1337/v1' },
  { label: 'vLLM', url: 'http://localhost:8000/v1' },
  { label: 'text-generation-webui', url: 'http://localhost:5000/v1' },
  { label: 'KoboldCpp', url: 'http://localhost:5001/v1' },
  { label: 'GPT4All', url: 'http://localhost:4891/v1' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
];

export class AiError extends Error {
  constructor(message, { provider, status, cause } = {}) {
    super(message);
    this.name = 'AiError';
    this.status = status;
    this.providerId = provider?.id;
    if (cause) this.cause = cause;
  }
}

/* ---------------------------------------------------------------- config */

/**
 * Accepts whatever a user pastes — `localhost:1234`, a full
 * `/v1/chat/completions` URL, an Ollama URL ending in `/api` — and returns the
 * base the request paths below are appended to.
 */
export function normalizeBaseUrl(raw, kind) {
  let url = String(raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;

  try {
    const parsed = new URL(url);
    let path = parsed.pathname.replace(/\/+$/, '');
    if (kind === 'ollama') {
      path = path.replace(/\/(api|v1)(\/.*)?$/i, '');
    } else {
      path = path.replace(/\/(chat\/completions|completions|models)$/i, '');
      if (!path) path = '/v1';
    }
    return `${parsed.origin}${path}`;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

/** The connection details for a provider id, taken from settings. */
export function resolveProvider(settings, providerId) {
  const meta = PROVIDERS[providerId] || PROVIDERS.ollama;
  const conf = settings?.aiProviders?.[meta.id] || {};
  return {
    id: meta.id,
    kind: meta.kind,
    label: meta.label,
    baseUrl: normalizeBaseUrl(conf.baseUrl ?? meta.defaultUrl, meta.kind),
    apiKey: String(conf.apiKey || '').trim(),
  };
}

/** Provider and model for one feature section such as `aiChat`. */
export function resolveFeature(settings, section) {
  const conf = settings?.[section] || {};
  return {
    conf,
    provider: resolveProvider(settings, conf.provider),
    model: String(conf.model || '').trim(),
  };
}

/* ------------------------------------------------------------ text utils */

/**
 * Strips the markdown fences small models add even when told not to.
 * Only a fence wrapping the *entire* reply is removed, so fenced blocks that
 * are genuinely part of the code (e.g. inside a markdown file) survive.
 */
export function stripCodeFences(text) {
  const trimmed = String(text || '').trim();
  const match = /^```[\w+#.-]*\n?([\s\S]*?)\n?```$/.exec(trimmed);
  if (match) return match[1];

  // An unterminated opening fence, which streaming reliably produces mid-flight.
  const opening = /^```[\w+#.-]*\n/.exec(trimmed);
  if (opening) return trimmed.slice(opening[0].length).replace(/\n?```\s*$/, '');

  return String(text || '');
}

/**
 * Removes the reasoning block that thinking models (DeepSeek-R1, Qwen3, …)
 * put before their answer. An unterminated block — still streaming — is cut
 * entirely so half a thought never reaches the editor.
 */
export function stripThinking(text) {
  let out = String(text || '').replace(/<think>[\s\S]*?<\/think>\s*/gi, '');
  const open = out.search(/<think>/i);
  if (open !== -1) out = out.slice(0, open);
  return out;
}

/** True while a thinking model is still inside its reasoning block. */
export function isThinking(text) {
  const str = String(text || '');
  const open = str.lastIndexOf('<think>');
  return open !== -1 && str.indexOf('</think>', open) === -1;
}

/* ------------------------------------------------------------- transport */

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorDetail(text) {
  const data = parseJson(text);
  const detail = typeof data?.error === 'string'
    ? data.error
    : data?.error?.message || data?.message || data?.detail || '';
  return String(detail || (data ? '' : text || '')).trim().slice(0, 300);
}

function unreachableMessage(provider) {
  const browserHint = hasNativeTransport()
    ? ''
    : ' If it is running, the browser may be blocking the request (CORS) — use the desktop app, or allow this origin on the server.';

  if (provider.id === 'ollama') {
    return `Cannot reach Ollama at ${provider.baseUrl}. Make sure Ollama is installed and running (\`ollama serve\`).`
      + (hasNativeTransport() ? '' : ` In a browser, start it with OLLAMA_ORIGINS=${window.location.origin}.`);
  }
  if (provider.id === 'lmstudio') {
    return `Cannot reach LM Studio at ${provider.baseUrl}. In LM Studio open the Developer tab and start the local server.`
      + (hasNativeTransport() ? '' : ' In a browser, also turn on "Enable CORS" in its server settings.');
  }
  return `Cannot reach ${provider.baseUrl}. Check the URL and that the server is running.${browserHint}`;
}

function modelMissingMessage(provider, model, detail) {
  if (provider.id === 'ollama') {
    return `Model "${model}" is not installed in Ollama. Run \`ollama pull ${model}\`, or pick an installed model in Settings → AI.`;
  }
  if (provider.id === 'lmstudio') {
    return `LM Studio could not use model "${model}"${detail ? ` (${detail})` : ''}. Download/load it in LM Studio, or pick another model in Settings → AI.`;
  }
  return `${provider.baseUrl} has no model "${model}"${detail ? ` (${detail})` : ''}. Pick another model in Settings → AI.`;
}

function httpError(provider, res, model) {
  const detail = extractErrorDetail(res.text);
  let message;
  if (res.status === 401 || res.status === 403) {
    message = `${provider.label} rejected the request (${res.status}). Check the API key in Settings → AI Providers.`;
  } else if (model && /model/i.test(detail) && /not found|not exist|no such|not installed|pull|not loaded|no models? loaded|invalid model/i.test(detail)) {
    message = modelMissingMessage(provider, model, detail);
  } else if (res.status === 404 && model && provider.kind === 'ollama') {
    message = modelMissingMessage(provider, model, detail);
  } else {
    message = `${provider.label} returned ${res.status}${res.statusText ? ` ${res.statusText}` : ''}${detail ? `: ${detail}` : ''}`;
  }
  return new AiError(message, { provider, status: res.status });
}

async function send(provider, path, { method = 'POST', body, signal, timeout = 60000, onChunk } = {}) {
  if (!provider.baseUrl) {
    throw new AiError(`Set a base URL for ${provider.label} in Settings → AI Providers.`, { provider });
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;

  let res;
  try {
    res = await aiRequest({
      url: /^https?:\/\//i.test(path) ? path : `${provider.baseUrl}${path}`,
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      timeout,
      onChunk,
    });
  } catch (err) {
    if (err?.name === 'NetworkError') {
      throw new AiError(unreachableMessage(provider), { provider, cause: err });
    }
    if (err?.name === 'TimeoutError') {
      throw new AiError(
        `${provider.label} did not answer in time (${err.message}). The model may still be loading — try again in a moment.`,
        { provider, cause: err },
      );
    }
    throw err;
  }

  if (!res.ok) throw httpError(provider, res, body?.model);
  return res;
}

function requireModel(provider, model) {
  if (!model) {
    throw new AiError(`No ${provider.label} model selected. Pick one in Settings → AI.`, { provider });
  }
}

function lineSplitter(onLine) {
  let buffer = '';
  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) onLine(line.trim());
      }
    },
    flush() {
      if (buffer.trim()) onLine(buffer.trim());
      buffer = '';
    },
  };
}

/* ------------------------------------------------------------------- API */

function isPrivateHost(url) {
  try {
    const host = new URL(url).hostname;
    return /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  } catch {
    return false;
  }
}

/**
 * Capability tags for a model. Servers that report capabilities (Ollama,
 * LM Studio) are trusted; the name fills in what they do not say.
 */
function inferCapabilities(id, reported = [], family = '') {
  const caps = new Set();
  const has = (c) => reported.includes(c);

  if (has('embedding') || /embed|(^|[/-])bge-|(^|[/-])e5-|minilm/i.test(id) || /bert/i.test(family)) {
    return ['embedding'];
  }
  caps.add('chat');
  if (/coder|code|starcoder|codestral|codegemma|devstral/i.test(id)) caps.add('code');
  if (has('insert') || supportsFim(id)) caps.add('fim');
  if (has('vision') || /llava|[-.:]vl\b|vl[:-]|vision|moondream|minicpm-v/i.test(id)) caps.add('vision');
  if (has('thinking') || /deepseek-r1|qwq|gpt-oss|magistral|thinking/i.test(id)) caps.add('thinking');
  if (has('tools')) caps.add('tools');
  return [...caps];
}

const byId = (a, b) => a.id.localeCompare(b.id);

/**
 * Everything a provider can serve, with whatever metadata it exposes.
 *
 * @returns {Promise<Array<{
 *   id: string, providerId: string, parameters: string, quantization: string,
 *   format: string, family: string, bytes: number, contextLength: number,
 *   location: 'local'|'cloud'|'remote', loaded: boolean, capabilities: string[]
 * }>>}
 */
export async function listModelDetails(provider, { signal, timeout = 6000 } = {}) {
  const base = { parameters: '', quantization: '', format: '', family: '', bytes: 0, contextLength: 0, loaded: false };

  if (provider.kind === 'ollama') {
    const [tags, running] = await Promise.all([
      send(provider, '/api/tags', { method: 'GET', signal, timeout }),
      // Which models are in memory; older servers have no /api/ps.
      send(provider, '/api/ps', { method: 'GET', signal, timeout }).catch((err) => {
        if (isAbortError(err)) throw err;
        return null;
      }),
    ]);
    const data = parseJson(tags.text);
    if (!Array.isArray(data?.models)) {
      throw new AiError(`${provider.baseUrl} answered, but it is not an Ollama server.`, { provider });
    }
    const loaded = new Set((parseJson(running?.text)?.models || []).map((m) => m.name || m.model));

    return data.models.map((m) => {
      const id = m.name || m.model;
      const d = m.details || {};
      const cloud = !!m.remote_host;
      return {
        ...base,
        id,
        providerId: provider.id,
        parameters: d.parameter_size || '',
        quantization: d.quantization_level || '',
        format: d.format || '',
        family: d.family || '',
        bytes: cloud ? 0 : (m.size || 0),
        location: cloud ? 'cloud' : 'local',
        loaded: loaded.has(id),
        capabilities: inferCapabilities(id, m.capabilities || [], d.family || ''),
      };
    }).filter((m) => m.id).sort(byId);
  }

  if (provider.id === 'lmstudio') {
    // LM Studio's own REST API adds type, quantization and load state.
    try {
      const res = await send(provider, `${new URL(provider.baseUrl).origin}/api/v0/models`, { method: 'GET', signal, timeout });
      const list = parseJson(res.text)?.data;
      if (Array.isArray(list)) {
        return list.filter((m) => m?.id).map((m) => ({
          ...base,
          id: m.id,
          providerId: provider.id,
          quantization: m.quantization || '',
          format: m.compatibility_type || '',
          family: m.arch || '',
          contextLength: m.max_context_length || 0,
          location: 'local',
          loaded: m.state === 'loaded',
          capabilities: inferCapabilities(m.id, [
            m.type === 'embeddings' ? 'embedding' : '',
            m.type === 'vlm' ? 'vision' : '',
          ]),
        })).sort(byId);
      }
    } catch (err) {
      // Only an HTTP error means "older LM Studio"; unreachable is final.
      if (isAbortError(err) || err?.status === undefined) throw err;
    }
  }

  const res = await send(provider, '/models', { method: 'GET', signal, timeout });
  const data = parseJson(res.text);
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null;
  if (!list) {
    throw new AiError(`${provider.baseUrl} answered, but it is not an OpenAI-compatible API. Check the base URL (it usually ends in /v1).`, { provider });
  }
  const location = isPrivateHost(provider.baseUrl) ? 'local' : 'remote';
  return list.filter((m) => m?.id).map((m) => ({
    ...base,
    id: m.id,
    providerId: provider.id,
    family: m.owned_by || '',
    contextLength: m.context_length || 0,
    location,
    capabilities: inferCapabilities(m.id, m.architecture?.input_modalities?.includes('image') ? ['vision'] : []),
  })).sort(byId);
}

/** Model ids usable for chat/completion. Throws AiError on failure. */
export async function listModels(provider, options) {
  const models = await listModelDetails(provider, options);
  // Embedding models cannot chat or complete; listing them only invites a bad pick.
  return [...new Set(models.filter((m) => !m.capabilities.includes('embedding')).map((m) => m.id))];
}

/** Well-known local ports, probed by "Scan This Computer". */
export const DISCOVERY_TARGETS = [
  { providerId: 'ollama', label: 'Ollama', url: 'http://localhost:11434' },
  { providerId: 'lmstudio', label: 'LM Studio', url: 'http://localhost:1234/v1' },
  ...OPENAI_COMPATIBLE_PRESETS
    .filter((p) => p.url.startsWith('http://localhost'))
    .map((p) => ({ providerId: 'openai', label: p.label, url: p.url })),
];

/** Probes every discovery target in parallel. Never throws (except on abort). */
export async function discoverServers({ signal, timeout = 2500 } = {}) {
  return Promise.all(DISCOVERY_TARGETS.map(async (target) => {
    const meta = PROVIDERS[target.providerId];
    const provider = {
      id: target.providerId,
      kind: meta.kind,
      label: target.label,
      baseUrl: normalizeBaseUrl(target.url, meta.kind),
      apiKey: '',
    };
    const result = await checkProvider(provider, { signal, timeout });
    return { ...target, url: provider.baseUrl, ok: result.ok, models: result.models, error: result.error };
  }));
}

/**
 * Downloads a model into Ollama, reporting `{ status, total, completed }` as
 * layers arrive. Resolves when the model is ready.
 */
export async function pullOllamaModel(provider, name, { signal, onProgress } = {}) {
  let streamError = null;
  const lines = lineSplitter((line) => {
    const chunk = parseJson(line);
    if (!chunk) return;
    if (chunk.error) {
      streamError = new AiError(`Ollama: ${chunk.error}`, { provider });
      return;
    }
    onProgress?.({ status: chunk.status || '', total: chunk.total || 0, completed: chunk.completed || 0 });
  });
  await send(provider, '/api/pull', {
    body: { model: name, name, stream: true },
    signal,
    // Idle timeout: digest verification of a large model can be quiet for a while.
    timeout: 300000,
    onChunk: lines.push,
  });
  lines.flush();
  if (streamError) throw streamError;
}

/** Never throws (except on abort): resolves to `{ ok, models, error, ms }`. */
export async function checkProvider(provider, options) {
  const started = Date.now();
  try {
    const models = await listModels(provider, options);
    return { ok: true, models, error: null, ms: Date.now() - started };
  } catch (err) {
    if (isAbortError(err)) throw err;
    return { ok: false, models: [], error: err?.message || 'Connection failed', ms: Date.now() - started };
  }
}

/** True when `model` is in `models`, treating Ollama's implicit `:latest` tag as equal. */
export function modelAvailable(models, model) {
  if (!model) return false;
  return models.includes(model)
    || models.includes(`${model}:latest`)
    || models.some((m) => m.replace(/:latest$/, '') === model);
}

function modelSize(name) {
  const match = /(?:^|[^\d.])(\d+(?:\.\d+)?)b(?![a-z])/i.exec(name);
  return match ? parseFloat(match[1]) : 7;
}

/**
 * Picks a sensible default from what is installed.
 * `completion` wants a small FIM-capable model; `chat` the largest coder model
 * that is still comfortably local; `fast` the smallest usable one.
 */
export function suggestModel(models, role = 'chat') {
  if (!models?.length) return '';
  const coders = models.filter((m) => /coder|code|starcoder|codestral|codegemma/i.test(m));
  const pool = coders.length ? coders : models;
  const bySize = [...pool].sort((a, b) => modelSize(a) - modelSize(b));

  if (role === 'completion') {
    const fim = [...models].filter((m) => supportsFim(m)).sort((a, b) => modelSize(a) - modelSize(b));
    return (fim[0] || bySize[0]);
  }
  if (role === 'fast') {
    return bySize.find((m) => modelSize(m) >= 1) || bySize[0];
  }
  const fitting = bySize.filter((m) => modelSize(m) <= 14);
  return fitting.length ? fitting[fitting.length - 1] : bySize[0];
}

/**
 * Chat completion. Streams when `onToken` is given and resolves with the full
 * text either way.
 */
export async function chat({
  provider,
  model,
  messages,
  temperature = 0.2,
  maxTokens,
  signal,
  timeout = 90000,
  onToken,
}) {
  requireModel(provider, model);

  let full = '';
  let streamError = null;
  const emit = (delta) => {
    if (!delta) return;
    full += delta;
    onToken?.(delta, full);
  };

  if (provider.kind === 'ollama') {
    const body = {
      model,
      messages,
      stream: !!onToken,
      options: { temperature, ...(maxTokens ? { num_predict: maxTokens } : {}) },
    };
    if (!onToken) {
      const res = await send(provider, '/api/chat', { body, signal, timeout });
      return parseJson(res.text)?.message?.content || '';
    }
    const lines = lineSplitter((line) => {
      const chunk = parseJson(line);
      if (chunk?.error) streamError = new AiError(`${provider.label}: ${chunk.error}`, { provider });
      emit(chunk?.message?.content);
    });
    await send(provider, '/api/chat', { body, signal, timeout, onChunk: lines.push });
    lines.flush();
    if (streamError) throw streamError;
    return full;
  }

  const body = {
    model,
    messages,
    temperature,
    stream: !!onToken,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  };
  if (!onToken) {
    const res = await send(provider, '/chat/completions', { body, signal, timeout });
    return parseJson(res.text)?.choices?.[0]?.message?.content || '';
  }

  const lines = lineSplitter((line) => {
    if (line.startsWith(':')) return; // SSE comment / keep-alive
    let payload = line;
    if (line.startsWith('data:')) payload = line.slice(5).trim();
    else if (!line.startsWith('{')) return;
    if (payload === '[DONE]') return;

    const chunk = parseJson(payload);
    if (!chunk) return;
    if (chunk.error) {
      streamError = new AiError(`${provider.label}: ${chunk.error.message || chunk.error}`, { provider });
      return;
    }
    const choice = chunk.choices?.[0];
    // A server that ignored `stream: true` sends one complete message.
    emit(choice?.delta?.content ?? choice?.message?.content);
  });
  await send(provider, '/chat/completions', { body, signal, timeout, onChunk: lines.push });
  lines.flush();
  if (streamError) throw streamError;
  return full;
}

/**
 * Raw text completion, used for fill-in-the-middle prompts. The prompt is sent
 * verbatim, with no chat template applied.
 */
export async function complete({
  provider,
  model,
  prompt,
  stop = [],
  temperature = 0.1,
  maxTokens = 128,
  signal,
  timeout = 20000,
}) {
  requireModel(provider, model);

  if (provider.kind === 'ollama') {
    const res = await send(provider, '/api/generate', {
      body: {
        model,
        prompt,
        raw: true,
        stream: false,
        // Keeps the model in memory between keystrokes; reloading costs seconds.
        keep_alive: '30m',
        options: { temperature, top_p: 0.9, num_predict: maxTokens, stop },
      },
      signal,
      timeout,
    });
    return parseJson(res.text)?.response || '';
  }

  const res = await send(provider, '/completions', {
    body: {
      model,
      prompt,
      temperature,
      top_p: 0.9,
      max_tokens: maxTokens,
      stream: false,
      // Hosted OpenAI-style APIs reject more than four stop sequences.
      ...(stop.length ? { stop: provider.id === 'openai' ? stop.slice(0, 4) : stop } : {}),
    },
    signal,
    timeout,
  });
  return parseJson(res.text)?.choices?.[0]?.text || '';
}
