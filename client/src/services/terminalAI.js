function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export async function generateCommand(query, settings) {
  if (!query || !query.trim()) return '';
  const { model, ollamaUrl } = settings;
  const base = normalizeUrl(ollamaUrl);

  const prompt = `Convert this natural language request into a single shell command. Reply with ONLY the command, no explanation:\n\n${query}`;

  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
  const data = await res.json();
  let cmd = (data.response || '').trim();
  cmd = cmd.replace(/^```(?:\w+)?\n?/, '').replace(/\n?```$/, '').trim();
  return cmd;
}

export async function explainTerminalError(errorOutput, settings) {
  if (!errorOutput || !errorOutput.trim()) return '';
  const { model, ollamaUrl } = settings;
  const base = normalizeUrl(ollamaUrl);

  const prompt = `Explain this terminal error and suggest a fix concisely:\n\n${errorOutput.slice(0, 2000)}`;

  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
  const data = await res.json();
  return data.response || '';
}
