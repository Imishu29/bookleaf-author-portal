const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const llm = require('./services/ai/llmClient');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin.split(','), credentials: false }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ai: llm.isConfigured() ? 'configured' : 'fallback-mode' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/events', require('./routes/events'));

// Single-service deployment: if the Angular build exists, serve it from the API origin
// (same origin => no CORS, and SSE works without a proxy). Skipped in local dev.
const uiDir = path.join(__dirname, '../../frontend/dist/frontend/browser');
if (fs.existsSync(uiDir)) {
  app.use(express.static(uiDir));
  app.get('/{*splat}', (req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile(path.join(uiDir, 'index.html'))));
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
