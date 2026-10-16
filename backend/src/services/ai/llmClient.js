const config = require('../../config');

class LlmUnavailableError extends Error {}

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_ATTEMPTS = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Thin wrapper over the Anthropic Messages API.
 *
 * - The key is read from the environment on the server only.
 * - `systemBlocks` are marked cacheable so the (static) knowledge base prefix is
 *   billed at the cheaper cached-input rate when the provider caches it.
 * - Hard timeout + one retry on 429/5xx. Anything else throws LlmUnavailableError
 *   and callers fall back to rules/templates, so a ticket is never lost.
 */
async function complete({ systemBlocks, user, maxTokens = 400, temperature = 0.2 }) {
  if (!config.ai.apiKey) throw new LlmUnavailableError('ANTHROPIC_API_KEY not configured');

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.ai.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.ai.model,
          max_tokens: maxTokens,
          temperature,
          system: systemBlocks.map((text, i) => ({
            type: 'text',
            text,
            ...(i === systemBlocks.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
          })),
          messages: [{ role: 'user', content: user }],
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new LlmUnavailableError(`LLM responded ${res.status}`);
        const retryAfter = Number(res.headers.get('retry-after')) || attempt;
        if (attempt < MAX_ATTEMPTS) await sleep(Math.min(retryAfter, 3) * 1000);
        continue;
      }
      if (!res.ok) throw new LlmUnavailableError(`LLM request rejected (${res.status})`);

      const data = await res.json();
      const text = (data.content || []).map((b) => b.text || '').join('').trim();
      if (!text) throw new LlmUnavailableError('LLM returned empty content');
      return { text, usage: data.usage };
    } catch (err) {
      lastErr = err instanceof LlmUnavailableError ? err : new LlmUnavailableError(err.name === 'AbortError' ? 'LLM timed out' : err.message);
      if (attempt >= MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

const isConfigured = () => Boolean(config.ai.apiKey);

module.exports = { complete, isConfigured, LlmUnavailableError };
