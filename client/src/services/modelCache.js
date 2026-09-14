import { checkProvider } from './llm';

// Shared across every settings field so six feature sections pointing at one
// server cost one request, not six.
const modelCache = new Map();
const CACHE_TTL = 30000;

export const providerCacheKey = (provider) => `${provider.id}|${provider.baseUrl}|${provider.apiKey ? 'key' : ''}`;

/** `checkProvider`, memoised for a short while per provider configuration. */
export function fetchModels(provider, { force = false } = {}) {
  const key = providerCacheKey(provider);
  const hit = modelCache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL) return hit.promise;
  const promise = checkProvider(provider);
  modelCache.set(key, { at: Date.now(), promise });
  return promise;
}

/** Forget cached model lists, e.g. after a model was downloaded. */
export function invalidateModelCache() {
  modelCache.clear();
}
