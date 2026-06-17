function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export async function explainCode(code, language, settings) {
  if (!code || !code.trim()) return '';
  const { model, ollamaUrl } = settings;
  const base = normalizeUrl(ollamaUrl);

  const prompt = `Explain the following ${language} code concisely. Describe what it does, its structure, and key patterns:\n\n${code}`;

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
