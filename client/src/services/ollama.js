function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export async function ollamaCompletion({ model, prompt, ollamaUrl, signal }) {
  const base = normalizeUrl(ollamaUrl);
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      raw: true,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        stop: ['<|endoftext|>', '<|fim_middle|>'],
      },
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.response || '';
}

export async function ollamaListModels(ollamaUrl) {
  const base = normalizeUrl(ollamaUrl);
  const res = await fetch(`${base}/api/tags`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.models || []).map(m => m.name);
}
