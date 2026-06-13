import { getFormatterForLanguage } from '../constants/settings';
import { MODES } from '../constants/modes';

const LANG_TO_PRETTIER_PARSER = {
  javascript: 'babel',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  markdown: 'markdown',
  yaml: 'yaml',
  graphql: 'graphql',
};

const LANG_TO_MONACO_LANG = {
  javascript: 'javascript',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  python: 'python',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  rust: 'rust',
  go: 'go',
};

export function getMonacoLanguage(filePath) {
  if (!filePath) return null;
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less',
    py: 'python',
    c: 'c', h: 'c',
    cpp: 'cpp', hpp: 'cpp',
    java: 'java',
    rs: 'rust',
    go: 'go',
    json: 'json', jsonc: 'json',
    md: 'markdown',
    yaml: 'yaml', yml: 'yaml',
    xml: 'xml', svg: 'xml',
    sql: 'sql',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    rb: 'ruby',
    php: 'php',
    kt: 'kotlin',
    dart: 'dart',
    swift: 'swift',
    r: 'r',
    pl: 'perl', pm: 'perl',
    lua: 'lua',
    toml: 'toml',
  };
  return map[ext] || null;
}

export async function formatDocument(fileName, content, mode, settings) {
  if (!fileName || !content) return content;

  const lang = getMonacoLanguage(fileName);
  if (!lang) return content;

  const formatterId = getFormatterForLanguage(lang, settings);
  if (!formatterId) return content;

  if (mode === MODES.LOCAL) {
    return formatLocal(formatterId, lang, content);
  }

  return formatOnline(formatterId, lang, content);
}

async function formatLocal(formatterId, lang, content) {
  if (!window.electronAPI?.formatter?.format) return content;
  try {
    const result = await window.electronAPI.formatter.format(formatterId, lang, content);
    if (result.error) {
      console.warn('Formatter error:', result.error);
      return content;
    }
    return result.formatted || content;
  } catch (err) {
    console.warn('Formatter failed:', err);
    return content;
  }
}

async function formatOnline(formatterId, lang, content) {
  try {
    const { default: axios } = await import('axios');
    const res = await axios.post(
      '/index/format',
      { formatter: formatterId, language: lang, sourceCode: content },
      { withCredentials: true }
    );
    if (res.data?.formatted) {
      return res.data.formatted;
    }
    return content;
  } catch (err) {
    console.warn('Online formatter failed:', err);
    return content;
  }
}

export function getAvailableFormatters() {
  return [
    { id: 'prettier', name: 'Prettier', languages: ['javascript', 'typescript', 'html', 'css', 'scss', 'less', 'json', 'markdown', 'yaml'] },
    { id: 'black', name: 'Black', languages: ['python'] },
    { id: 'clang-format', name: 'clang-format', languages: ['c', 'cpp'] },
    { id: 'google-java-format', name: 'google-java-format', languages: ['java'] },
    { id: 'rustfmt', name: 'rustfmt', languages: ['rust'] },
    { id: 'gofmt', name: 'gofmt', languages: ['go'] },
  ];
}
