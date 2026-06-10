// ollama-client.js - OpenAI-compatible chat/completions client for Ollama.
// Works with both local (127.0.0.1:11434/v1) and cloud (ollama.com/v1) endpoints.
//
// P1 surface:
//   - chat({ model, messages, temperature, baseUrl, apiKey }) -> { content, usage }

export class OllamaClientError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'OllamaClientError';
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 90_000;

export async function chat({
  model,
  messages,
  temperature = 0.4,
  baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
  apiKey = process.env.OLLAMA_API_KEY || '',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!model) throw new OllamaClientError('model is required', 'ollama.model.missing');
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new OllamaClientError('messages must be a non-empty array', 'ollama.messages.empty');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers['authorization'] = `Bearer ${apiKey}`;

  const body = JSON.stringify({
    model,
    messages,
    temperature,
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body,
      signal: ac.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new OllamaClientError(
        `Ollama ${res.status}: ${text.slice(0, 200)}`,
        'ollama.request.failed',
        res.status,
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content && content !== '') {
      throw new OllamaClientError(
        'Ollama returned no content',
        'ollama.response.empty',
      );
    }

    return {
      content,
      usage: data?.usage || null,
      model: data?.model || model,
    };
  } catch (err) {
    if (err instanceof OllamaClientError) throw err;
    const code = err.name === 'AbortError' ? 'ollama.request.timeout' : 'ollama.request.failed';
    throw new OllamaClientError(`Ollama request failed: ${err.message}`, code);
  } finally {
    clearTimeout(timer);
  }
}
