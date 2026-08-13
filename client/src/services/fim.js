/**
 * Fill-in-the-middle prompt construction.
 *
 * Every code model family uses its own sentinel tokens, and sending the wrong
 * ones produces prose instead of code. This module maps a model name onto the
 * right template and the stop tokens that terminate its middle section.
 */

const TEMPLATES = {
  qwen: {
    match: /qwen|codeqwen/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
    stop: ['<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>', '<|fim_pad|>', '<|endoftext|>', '<|repo_name|>', '<|file_sep|>'],
    repo: (files) => files.map(f => `<|file_sep|>${f.name}\n${f.content}`).join('') + (files.length ? '<|file_sep|>' : ''),
  },
  deepseek: {
    match: /deepseek/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<｜fim▁begin｜>${prefix}<｜fim▁hole｜>${suffix}<｜fim▁end｜>`,
    stop: ['<｜fim▁begin｜>', '<｜fim▁hole｜>', '<｜fim▁end｜>', '<|EOT|>', '<｜end▁of▁sentence｜>'],
    repo: (files) => files.map(f => `//${f.name}\n${f.content}\n`).join(''),
  },
  starcoder: {
    match: /starcoder|stable-code|santacoder/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`,
    stop: ['<fim_prefix>', '<fim_suffix>', '<fim_middle>', '<|endoftext|>', '<file_sep>'],
    repo: (files) => files.map(f => `<file_sep>${f.name}\n${f.content}`).join('') + (files.length ? '<file_sep>' : ''),
  },
  codegemma: {
    match: /codegemma|gemma/i,
    build: ({ prefix, suffix, repoContext }) =>
      `${repoContext}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
    stop: ['<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>', '<|file_separator|>', '<end_of_turn>', '<eos>'],
    repo: (files) => files.map(f => `<|file_separator|>${f.name}\n${f.content}`).join(''),
  },
  codellama: {
    match: /codellama|code-llama/i,
    build: ({ prefix, suffix }) => `<PRE> ${prefix} <SUF>${suffix} <MID>`,
    stop: ['<PRE>', '<SUF>', '<MID>', '<EOT>', '</s>'],
    repo: () => '',
  },
};

const FALLBACK = {
  // Non-FIM models get a plain instruction prompt through /api/chat instead.
  build: ({ prefix, suffix, repoContext }) =>
    `${repoContext}<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
  stop: ['<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>', '<|endoftext|>'],
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
 * @param {string} args.model      Ollama model name, decides the sentinel dialect.
 * @param {string} args.prefix     Text before the cursor.
 * @param {string} args.suffix     Text after the cursor.
 * @param {Array<{name:string,content:string}>} args.contextFiles Neighbouring files.
 * @returns {{prompt:string, stop:string[]}}
 */
export function buildFimPrompt({ model, prefix, suffix, contextFiles = [] }) {
  const template = getTemplate(model);
  const repoContext = contextFiles.length ? template.repo(contextFiles) : '';
  return {
    prompt: template.build({ prefix, suffix, repoContext }),
    stop: template.stop,
  };
}

/** Removes any sentinel token the model echoed back into its output. */
export function stripSentinels(text, model) {
  const template = getTemplate(model);
  let out = text;
  // If the model restated the middle marker, everything useful follows it.
  for (const marker of ['<|fim_middle|>', '<fim_middle>', '<MID>', '<｜fim▁end｜>']) {
    const idx = out.indexOf(marker);
    if (idx !== -1) out = out.slice(idx + marker.length);
  }
  for (const token of template.stop) {
    const idx = out.indexOf(token);
    if (idx !== -1) out = out.slice(0, idx);
  }
  return out;
}
