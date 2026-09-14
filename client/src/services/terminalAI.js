import { resolveFeature, chat, stripThinking, stripCodeFences } from './llm';

function describeShell() {
  const platform = window.electronAPI?.platform;
  if (platform === 'win32') return 'Windows (PowerShell)';
  if (platform === 'darwin') return 'macOS (zsh)';
  return 'Linux (bash)';
}

/** Reduces a chatty reply to the one command it contains. */
function extractCommand(reply) {
  const lines = stripCodeFences(stripThinking(reply))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  return (lines[0] || '').replace(/^\$\s+/, '').replace(/^`+|`+$/g, '').trim();
}

export async function generateCommand(query, settings, { signal } = {}) {
  if (!query || !query.trim()) return '';
  const { provider, model } = resolveFeature(settings, 'terminalAI');

  const reply = await chat({
    provider,
    model,
    temperature: 0.1,
    maxTokens: 200,
    signal,
    timeout: 60000,
    messages: [
      {
        role: 'system',
        content: `Convert the user's request into a single shell command for ${describeShell()}. Reply with ONLY the command on one line: no explanation, no markdown.`,
      },
      { role: 'user', content: query.trim() },
    ],
  });

  return extractCommand(reply);
}

export async function explainTerminalError(errorOutput, settings, { signal } = {}) {
  if (!errorOutput || !errorOutput.trim()) return '';
  const { provider, model } = resolveFeature(settings, 'terminalAI');

  const reply = await chat({
    provider,
    model,
    temperature: 0.2,
    signal,
    timeout: 90000,
    messages: [
      { role: 'system', content: `You help a developer on ${describeShell()} understand terminal errors. Explain the cause briefly and suggest a concrete fix.` },
      { role: 'user', content: errorOutput.slice(-4000) },
    ],
  });

  return stripThinking(reply).trim();
}
