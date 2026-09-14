export const SETTINGS_KEY = 'codecast_settings';

export const DEFAULT_SETTINGS = {
  editor: {
    fontSize: 14,
    showMinimap: true,
    autoSave: false,
    theme: 'dark',
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'off',
    fontFamily: 'default',
    fontLigatures: false,
    lineHeight: 0,
    cursorStyle: 'line',
    cursorBlinking: 'smooth',
    renderWhitespace: 'selection',
    bracketPairColorization: true,
    stickyScroll: true,
    indentGuides: true,
    lineNumbers: 'on',
    rulers: '',
    smoothScrolling: true,
    linkedEditing: true,
    autoClosingBrackets: 'languageDefined',
    formatOnPaste: false,
    formatOnType: false,
    breadcrumbs: true,
    dragAndDrop: true,
    mouseWheelZoom: true,
    suggestSelection: 'first',
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    scrollBeyondLastLine: true,
    codeLens: false,
  },
  files: {
    autoSaveMode: 'afterDelay',
    autoSaveDelay: 1000,
    trimTrailingWhitespace: false,
    insertFinalNewline: false,
    trimFinalNewlines: false,
    hotExit: true,
    restoreSession: true,
    confirmDelete: true,
  },
  formatter: {
    formatOnSave: false,
    defaultFormatters: {
      javascript: 'prettier',
      typescript: 'prettier',
      html: 'prettier',
      css: 'prettier',
      scss: 'prettier',
      less: 'prettier',
      json: 'prettier',
      markdown: 'prettier',
      yaml: 'prettier',
      python: 'black',
      c: 'clang-format',
      cpp: 'clang-format',
      java: 'google-java-format',
      rust: 'rustfmt',
      go: 'gofmt',
    },
  },
  lsp: {
    enabled: true,
    diagnostics: true,
    autocomplete: true,
    refactoring: true,
  },
  aiProviders: {
    ollama: { baseUrl: 'http://localhost:11434' },
    lmstudio: { baseUrl: 'http://localhost:1234/v1' },
    openai: { baseUrl: '', apiKey: '' },
  },
  commitMessage: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
  },
  aiAutocomplete: {
    enabled: false,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    promptMode: 'auto',
    triggerMode: 'auto',
    debounceMs: 350,
    maxTokens: 128,
    temperature: 0.1,
    multiline: true,
    maxPrefixChars: 4000,
    maxSuffixChars: 1500,
    useOpenFileContext: true,
    skipInComments: true,
    cacheSize: 60,
    requestTimeoutMs: 12000,
  },
  aiChat: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    temperature: 0.3,
    includeActiveFile: true,
    maxHistory: 12,
  },
  aiEdit: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    temperature: 0.1,
  },
  playbackExplanation: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    autoExplain: false,
  },
  terminalAI: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
  },
};

/**
 * Settings sections backed by a model, with the kind of model each one wants
 * (used when picking a default from what a provider has installed).
 */
export const AI_FEATURES = [
  { section: 'aiAutocomplete', label: 'Autocomplete', role: 'completion' },
  { section: 'aiChat', label: 'Chat', role: 'chat' },
  { section: 'aiEdit', label: 'Inline Edit', role: 'chat' },
  { section: 'commitMessage', label: 'Commit Messages', role: 'fast' },
  { section: 'playbackExplanation', label: 'Explain', role: 'fast' },
  { section: 'terminalAI', label: 'Terminal', role: 'fast' },
];

export const AI_SECTIONS = AI_FEATURES.map((f) => f.section);

const PROVIDER_IDS = ['ollama', 'lmstudio', 'openai'];

export const SUGGESTED_MODELS = [
  'qwen2.5-coder:1.5b',
  'qwen2.5-coder:3b',
  'qwen2.5-coder:7b',
  'qwen2.5-coder:14b',
  'codellama:7b',
  'codellama:13b',
  'codellama:34b',
  'stable-code:3b',
  'deepseek-coder:6.7b',
  'starcoder2:3b',
  'starcoder2:7b',
  'codegemma:7b',
];

export function getFormatterForLanguage(lang, settings) {
  if (settings?.formatter?.defaultFormatters && lang in settings.formatter.defaultFormatters) {
    return settings.formatter.defaultFormatters[lang] || null;
  }
  return DEFAULT_SETTINGS.formatter.defaultFormatters[lang] || null;
}

export function getFormatterDisplayName(formatterId) {
  const names = {
    prettier: 'Prettier',
    black: 'Black',
    'clang-format': 'clang-format',
    'google-java-format': 'google-java-format',
    rustfmt: 'rustfmt',
    gofmt: 'gofmt',
  };
  return names[formatterId] || formatterId;
}

export function cloneDefaults() {
  return deepMerge(DEFAULT_SETTINGS, {});
}

/**
 * Upgrades settings saved by older versions, where every AI section carried
 * its own `ollamaUrl`, to the shared `aiProviders` block.
 */
export function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = { ...raw };

  let legacyUrl = null;
  for (const section of ['aiChat', ...AI_SECTIONS]) {
    const conf = next[section];
    if (!conf || typeof conf !== 'object') continue;
    if (!legacyUrl && typeof conf.ollamaUrl === 'string' && conf.ollamaUrl.trim()) {
      legacyUrl = conf.ollamaUrl.trim();
    }
    const rest = { ...conf };
    delete rest.ollamaUrl;
    if (rest.provider !== undefined && !PROVIDER_IDS.includes(rest.provider)) rest.provider = 'ollama';
    next[section] = rest;
  }

  if (legacyUrl && !next.aiProviders?.ollama?.baseUrl) {
    next.aiProviders = {
      ...(next.aiProviders || {}),
      ollama: { ...(next.aiProviders?.ollama || {}), baseUrl: legacyUrl },
    };
  }
  return next;
}

/** Layers saved (possibly partial or legacy) settings over a base object. */
export function mergeSettings(base, overrides) {
  return deepMerge(base || DEFAULT_SETTINGS, migrateSettings(overrides));
}

/** A copy without API keys, for syncing settings to the Code Cast server. */
export function withoutSecrets(settings) {
  const providers = {};
  for (const [id, conf] of Object.entries(settings?.aiProviders || {})) {
    const rest = { ...(conf || {}) };
    delete rest.apiKey;
    providers[id] = rest;
  }
  return { ...settings, aiProviders: providers };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw));
    }
  } catch { /* corrupted settings fall back to defaults */ }
  return cloneDefaults();
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function deepMerge(defaults, overrides) {
  const result = {};
  for (const key of Object.keys(defaults)) {
    const value = defaults[key];
    result[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(value, {}) : value;
  }
  for (const key of Object.keys(overrides || {})) {
    const value = overrides[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMerge(result[key] && typeof result[key] === 'object' ? result[key] : {}, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
