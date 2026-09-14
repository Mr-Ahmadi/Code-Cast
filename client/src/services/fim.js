/**
 * Fill-in-the-middle prompt construction.
 *
 * Every code model family uses its own sentinel tokens, and sending the wrong
 * ones produces prose instead of code. This module maps a model name onto the
 * right template and the stop tokens that terminate its middle section.
 *
 * Models that match no template are not FIM-trained; autocomplete asks those
 * through a chat prompt instead (see autocomplete.js).
 */

const TEMPLATES = {
  qwen: {
    // Qwen2.5-Coder / Qwen3-Coder. Plain Qwen chat models are not FIM-trained.
    match: /qwen[\w.]*[-_: /]?coder|codeqwen/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
    // Ordered by importance: hosted OpenAI-style APIs only accept the first four.
    // Instruct builds also end turns with the ChatML tokens.
    stop: ['<|endoftext|>', '<|file_sep|>', '<|fim_prefix|>', '<|im_end|>', '<|fim_suffix|>', '<|fim_middle|>', '<|fim_pad|>', '<|repo_name|>', '<|im_start|>'],
    // Repo-level format: the current file's path must follow the last separator,
    // otherwise the model starts writing a new file instead of the middle.
    repo: (files, fileName) => `<|repo_name|>workspace\n`
      + files.map(f => `<|file_sep|>${f.name}\n${f.content}\n`).join('')
      + `<|file_sep|>${fileName || 'untitled'}\n`,
  },
  deepseek: {
    match: /deepseek[-_ ]?coder/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<｜fim▁begin｜>${prefix}<｜fim▁hole｜>${suffix}<｜fim▁end｜>`,
    stop: ['<｜end▁of▁sentence｜>', '<|EOT|>', '<｜fim▁begin｜>', '<｜fim▁hole｜>', '<｜fim▁end｜>'],
    repo: (files) => files.map(f => `//${f.name}\n${f.content}\n`).join(''),
  },
  starcoder: {
    match: /starcoder|stable-code|santacoder/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`,
    stop: ['<|endoftext|>', '<fim_prefix>', '<fim_suffix>', '<fim_middle>', '<file_sep>'],
    repo: (files) => files.map(f => `<file_sep>${f.name}\n${f.content}`).join('') + (files.length ? '<file_sep>' : ''),
  },
  codegemma: {
    // Only CodeGemma is FIM-trained; general Gemma models are not.
    match: /codegemma/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
    stop: ['<|file_separator|>', '<end_of_turn>', '<eos>', '<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>'],
    repo: (files) => files.map(f => `<|file_separator|>${f.name}\n${f.content}`).join(''),
  },
  codestral: {
    match: /codestral/i,
    build: ({ prefix, suffix }) => `[SUFFIX]${suffix}[PREFIX]${prefix}`,
    stop: ['</s>', '[PREFIX]', '[SUFFIX]', '[MIDDLE]'],
    repo: () => '',
  },
  codellama: {
    match: /codellama|code-llama/i,
    build: ({ prefix, suffix }) => `<PRE> ${prefix} <SUF>${suffix} <MID>`,
    stop: ['<EOT>', '</s>', '<PRE>', '<SUF>', '<MID>'],
    repo: () => '',
  },
};

const FALLBACK = {
  build: ({ prefix, suffix, repoContext }) =>
    `${repoContext}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
  stop: ['<|endoftext|>', '<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>'],
  repo: (files) => files.map(f => `// ${f.name}\n${f.content}\n`).join(''),
};

export function getTemplate(model = '') {
  for (const key of Object.keys(TEMPLATES)) {
    if (TEMPLATES[key].match.test(model)) return TEMPLATES[key];
  }
  return FALLBACK;
}

export function supportsFim(model = '') {
  return Object.values(TEMPLATES).some(t => t.match.test(model));
}

/**
 * @param {object} args
 * @param {string} args.model      Model name, decides the sentinel dialect.
 * @param {string} args.prefix     Text before the cursor.
 * @param {string} args.suffix     Text after the cursor.
 * @param {Array<{name:string,content:string}>} args.contextFiles Neighbouring files.
 * @param {string} [args.fileName] Path of the file being edited.
 * @returns {{prompt:string, stop:string[]}}
 */
export function buildFimPrompt({ model, prefix, suffix, contextFiles = [], fileName = '' }) {
  const template = getTemplate(model);
  const repoContext = contextFiles.length ? template.repo(contextFiles, fileName) : '';
  return {
    prompt: template.build({ prefix, suffix, repoContext }),
    stop: template.stop,
  };
}

/**
 * End-of-turn tokens from chat templates. A model served under the wrong
 * template (or an instruct build) emits these and then keeps talking, so
 * nothing after them is ever part of the completion. `</s>` is left out on
 * purpose: it is also a real HTML closing tag.
 */
const END_TOKENS = ['<|endoftext|>', '<|im_end|>', '<|im_start|>', '<|eot_id|>', '<|end|>', '<end_of_turn>', '<|EOT|>', '<EOT>', '<|file_sep|>', '<file_sep>', '<|file_separator|>'];

/** Removes any sentinel token the model echoed back into its output. */
export function stripSentinels(text, model) {
  const template = getTemplate(model);
  let out = text;
  // If the model restated the middle marker, everything useful follows it.
  for (const marker of ['<|fim_middle|>', '<fim_middle>', '<MID>', '<｜fim▁end｜>', '[MIDDLE]']) {
    const idx = out.indexOf(marker);
    if (idx !== -1) out = out.slice(idx + marker.length);
  }
  for (const token of [...template.stop, ...END_TOKENS]) {
    const idx = out.indexOf(token);
    if (idx !== -1) out = out.slice(0, idx);
  }
  return out;
}
