require('dotenv').config();

const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
const geminiKey = process.env.GEMINI_API_KEY || '';

// Provider is explicit via AI_PROVIDER, otherwise inferred from whichever key is set.
const provider = process.env.AI_PROVIDER || (anthropicKey ? 'anthropic' : geminiKey ? 'gemini' : 'none');

const DEFAULT_MODELS = { anthropic: 'claude-haiku-5-5', gemini: 'gemini-3.5-flash', none: '' };

const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookleaf',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',
  ai: {
    provider,
    apiKey: provider === 'gemini' ? geminiKey : anthropicKey,
    model: process.env.AI_MODEL || DEFAULT_MODELS[provider] || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 15000,
  },
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
}

module.exports = config;
