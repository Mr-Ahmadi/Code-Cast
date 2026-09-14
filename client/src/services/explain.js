import { resolveFeature, chat, stripThinking } from './llm';

const SYSTEM_PROMPT = [
  'You explain code to someone watching a coding screencast.',
  'Be concise and concrete: what the code does, how it is structured, and any notable patterns or pitfalls.',
  'Use short paragraphs or bullet points. Do not repeat the code back.',
].join('\n');

/**
 * @param {string} code
 * @param {string} language
 * @param {object} settings  The full app settings object.
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {(text: string) => void} [options.onProgress] Receives the partial explanation.
 */
export async function explainCode(code, language, settings, { signal, onProgress } = {}) {
  if (!code || !code.trim()) return '';
  const { provider, model } = resolveFeature(settings, 'playbackExplanation');

  const text = await chat({
    provider,
    model,
    temperature: 0.2,
    signal,
    timeout: 120000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Explain this ${language} code:\n\n${code.slice(0, 12000)}` },
    ],
    onToken: onProgress ? (_delta, acc) => onProgress(stripThinking(acc)) : undefined,
  });

  return stripThinking(text).trim();
}
