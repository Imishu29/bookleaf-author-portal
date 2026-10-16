const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const llm = require('./services/ai/llmClient');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${config.mongoUri}`);
  console.log(llm.isConfigured() ? `AI enabled (${config.ai.provider}: ${config.ai.model})` : 'AI key not set -> rule-based fallback mode');

  app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
