require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const pool         = require('./db/pool');
const runMigrations = require('./db/runMigrations');
const { apiLimiter } = require('./middleware/rateLimiters');

const authRoutes       = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const adminRoutes      = require('./routes/admin');
const userRoutes       = require('./routes/user');
require('./queue/logWorker');

const app  = express();
const PORT = process.env.PORT || 3001;

// Trust the nginx reverse proxy so rate limiters see real client IPs
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,      // pure API — no HTML to protect
  crossOriginEmbedderPolicy: false,  // not serving embedded content
}));

// ── Cross-origin ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));

// ── Body parsing with size cap (prevents oversized JSON payload attacks) ──────
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Global rate limiter — applied to every /api/* route ──────────────────────
app.use('/api', apiLimiter);

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'jboard-backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth',       authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/user',       userRoutes);

// ── 404 handler — catches any unrecognised route ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler — never leaks stack traces to the client ─────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  console.log('Running database migrations...');
  await runMigrations(pool);
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
