export const SETTINGS_KEY = 'codecast_settings';

export const DEFAULT_SETTINGS = {
  editor: {
    fontSize: 14,
    showMinimap: true,
    autoSave: false,
    theme: 'dark',
    tabSize: 4,
    wordWrap: 'off',
    fontFamily: 'default',
    cursorStyle: 'line',
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
    model: 'opencode/claude-sonnet-4',
  },
  aiAutocomplete: {
    enabled: false,
    provider: 'ollama',
    model: 'qwen2.5-coder:1.5b',
    ollamaUrl: 'http://localhost:11434',
  },
};

export function getFormatterForLanguage(lang, settings) {
  if (settings?.formatter?.defaultFormatters?.[lang]) {
    return settings.formatter.defaultFormatters[lang];
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

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return deepMerge(DEFAULT_SETTINGS, parsed);
    }
  } catch {}
  return { ...DEFAULT_SETTINGS, editor: { ...DEFAULT_SETTINGS.editor }, formatter: { ...DEFAULT_SETTINGS.formatter, defaultFormatters: { ...DEFAULT_SETTINGS.formatter.defaultFormatters } }, lsp: { ...DEFAULT_SETTINGS.lsp }, commitMessage: { ...DEFAULT_SETTINGS.commitMessage }, aiAutocomplete: { ...DEFAULT_SETTINGS.aiAutocomplete } };
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
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = deepMerge(result[key] || {}, overrides[key]);
    } else if (overrides[key] !== undefined) {
      result[key] = overrides[key];
    }
  }
  return result;
}
