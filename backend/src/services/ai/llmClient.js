const config = require('../../config');

class LlmUnavailableError extends Error {}

const MAX_ATTEMPTS = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Provider adapters. Each builds the HTTP request and extracts the text from the
 * response, so the retry / timeout / fallback logic below is provider-agnostic.
 * `systemBlocks` are ordered static-first so providers that cache prefixes can reuse them.
 */
const providers = {
  anthropic: {
    request: ({ systemBlocks, user, maxTokens, temperature }) => ({
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': config.ai.apiKey, 'anthropic-version': '2023-06-01' },
      body: {
        model: config.ai.model,
        max_tokens: maxTokens,
        temperature,
        system: systemBlocks.map((text, i) => ({
          type: 'text',
          text,
          ...(i === systemBlocks.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
        })),
        messages: [{ role: 'user', content: user }],
      },
    }),
    extract: (data) => ({
      text: (data.content || []).map((b) => b.text || '').join('').trim(),
      usage: data.usage,
    }),
  },

  gemini: {
    request: ({ systemBlocks, user, maxTokens, temperature }) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.model}:generateContent`,
      headers: { 'x-goog-api-key': config.ai.apiKey },
      body: {
        systemInstruction: { parts: systemBlocks.map((text) => ({ text })) },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        // Thinking budget 0: short structured tasks, keeps latency and token use low.
        generationConfig: { maxOutputTokens: maxTokens, temperature, thinkingConfig: { thinkingBudget: 0 } },
      },
    }),
    extract: (data) => ({
      text: (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim(),
      usage: data.usageMetadata,
    }),
  },
};

const isConfigured = () => Boolean(config.ai.apiKey && providers[config.ai.provider]);

/**
 * - The key is read from the environment on the server only.
 * - Hard timeout + one retry on 429/5xx. Anything else throws LlmUnavailableError
 *   and callers fall back to rules/templates, so a ticket is never lost.
 */
async function complete({ systemBlocks, user, maxTokens = 400, temperature = 0.2 }) {
  if (!isConfigured()) throw new LlmUnavailableError('No AI API key configured');
  const adapter = providers[config.ai.provider];

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
    try {
      const { url, headers, body } = adapter.request({ systemBlocks, user, maxTokens, temperature });
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new LlmUnavailableError(`LLM responded ${res.status}`);
        const retryAfter = Number(res.headers.get('retry-after')) || attempt;
        if (attempt < MAX_ATTEMPTS) await sleep(Math.min(retryAfter, 3) * 1000);
        continue;
      }
      if (!res.ok) throw new LlmUnavailableError(`LLM request rejected (${res.status})`);

      const out = adapter.extract(await res.json());
      if (!out.text) throw new LlmUnavailableError('LLM returned empty content');
      return out;
    } catch (err) {
      lastErr = err instanceof LlmUnavailableError ? err : new LlmUnavailableError(err.name === 'AbortError' ? 'LLM timed out' : err.message);
      if (attempt >= MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

module.exports = { complete, isConfigured, LlmUnavailableError };
