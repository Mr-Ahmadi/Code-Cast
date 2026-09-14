/**
 * Inline AI edit — rewrites a selection (or the whole file) from a natural
 * language instruction.
 *
 * Unlike chat, the result has to be *applicable code*, so the prompt forbids
 * commentary and the response is stripped back to bare code before it reaches
 * the editor.
 */

import { resolveFeature, chat, stripCodeFences, stripThinking } from './llm';

export { stripCodeFences };

const SYSTEM_PROMPT = [
  'You are a code editing engine embedded in an IDE.',
  'You rewrite the code the user gives you according to their instruction.',
  'Rules:',
  '- Reply with the rewritten code ONLY. No explanations, no commentary, no markdown fences.',
  '- Preserve the original indentation style and the surrounding code conventions.',
  '- Return the complete replacement for the given region, not a diff or a fragment.',
  '- If the instruction does not require a change, return the code unchanged.',
].join('\n');

const clean = (text) => stripCodeFences(stripThinking(text));

function buildUserMessage({ instruction, code, language, fileName, prefix, suffix }) {
  const parts = [];
  if (fileName) parts.push(`File: ${fileName}`);
  if (prefix) parts.push(`Code before the region:\n${prefix}`);
  if (suffix) parts.push(`Code after the region:\n${suffix}`);
  parts.push(`Region to rewrite (${language}):\n${code}`);
  parts.push(`Instruction: ${instruction}`);
  return parts.join('\n\n');
}

/**
 * Streams a rewrite of `code`.
 *
 * @param {object} args
 * @param {string} args.instruction  What the user typed.
 * @param {string} args.code         The region being rewritten.
 * @param {string} args.language     Monaco language id, for the prompt.
 * @param {string} [args.fileName]
 * @param {string} [args.prefix]     Code above the region, for context.
 * @param {string} [args.suffix]     Code below the region, for context.
 * @param {object} args.settings     The app settings object.
 * @param {AbortSignal} [args.signal]
 * @param {(text: string) => void} [args.onProgress] Called with the cleaned
 *   partial result so the caller can preview the rewrite as it streams.
 * @returns {Promise<string>} The cleaned rewritten code.
 */
export async function streamAiEdit({
  instruction,
  code,
  language,
  fileName,
  prefix = '',
  suffix = '',
  settings,
  signal,
  onProgress,
}) {
  const { conf, provider, model } = resolveFeature(settings, 'aiEdit');
  if (conf.enabled === false) {
    throw new Error('AI edit is disabled. Enable it in Settings.');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildUserMessage({
        instruction,
        code,
        language,
        fileName,
        prefix: prefix.slice(-2000),
        suffix: suffix.slice(0, 1000),
      }),
    },
  ];

  const full = await chat({
    provider,
    model,
    messages,
    temperature: conf.temperature ?? 0.1,
    signal,
    timeout: 120000,
    onToken: onProgress ? (_delta, acc) => onProgress(clean(acc)) : undefined,
  });

  return clean(full).replace(/\s+$/, '');
}
