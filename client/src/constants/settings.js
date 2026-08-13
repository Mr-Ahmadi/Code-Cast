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
  commitMessage: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    ollamaUrl: 'http://localhost:11434',
  },
  aiAutocomplete: {
    enabled: false,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    ollamaUrl: 'http://localhost:11434',
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
    ollamaUrl: 'http://localhost:11434',
    temperature: 0.3,
    includeActiveFile: true,
    maxHistory: 12,
  },
  aiEdit: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    ollamaUrl: 'http://localhost:11434',
    temperature: 0.1,
  },
  playbackExplanation: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    ollamaUrl: 'http://localhost:11434',
    autoExplain: false,
  },
  terminalAI: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    ollamaUrl: 'http://localhost:11434',
  },
};

/** Sections whose model/url fields describe an Ollama-backed feature. */
export const AI_SECTIONS = [
  'aiAutocomplete', 'aiChat', 'aiEdit', 'commitMessage', 'playbackExplanation', 'terminalAI',
];

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

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return deepMerge(DEFAULT_SETTINGS, parsed);
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
