'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const db = require('./db');

// Import visitor tracking
const trackVisitor = require('./middleware/visitor.middleware');
const visitorService = require('./services/visitor.service');

// ── Env validation (fail fast) ───────────────────────────────────────────────
const envSchema = Joi.object({
  JWT_SECRET: Joi.string().min(32).required()
    .messages({ 'any.required': 'JWT_SECRET must be set (min 32 chars)' }),
  PORT: Joi.number().optional(),
  ALLOWED_ORIGINS: Joi.string().optional(),
  DB_TYPE: Joi.string().valid('sqlite', 'mysql').optional(),
  EMAIL_USER: Joi.string().optional(),
  EMAIL_PASS: Joi.string().optional(),
  APP_URL: Joi.string().uri().optional()
}).unknown(true);

const { error: envError } = envSchema.validate(process.env, { abortEarly: false });
if (envError) {
  console.error('❌ Environment configuration errors:');
  envError.details.forEach(d => console.error('  -', d.message));
  process.exit(1);
}

const app = express();

// ── Security headers ────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com", "https://randomuser.me", "https://via.placeholder.com"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// ── CORS - Controlled allowlist ──────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept', 'X-Requested-With']
}));

// ── Error handler for CORS ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ error: 'CORS not allowed for this origin' });
  }
  next(err);
});

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Cookie parser ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Visitor tracking middleware ──────────────────────────────────────────────
app.use(trackVisitor);

// ── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
}));

// ── Request logger ────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${ip}`);
    next();
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/orders', require('./routes/orders'));
app.use('/admin-api', require('./routes/admin'));
app.use('/worker-api', require('./routes/worker'));
app.use('/mpesa', require('./routes/mpesa'));
app.use('/production', require('./routes/production'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() })
);

// ── Static files ──────────────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Serve static files with proper MIME types
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Serve admin panel
app.use('/admin', express.static(path.join(PUBLIC_DIR, 'admin'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Serve worker panel
app.use('/worker', express.static(path.join(PUBLIC_DIR, 'worker'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// Serve JS files
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve CSS files
app.use('/css', express.static(path.join(PUBLIC_DIR, 'css')));

// ── HTML Route Handler - This is the key for mobile navigation ──────────────
const htmlFiles = [
  'index', 'gallary', 'order', 'customer-login', 'customer-dashboard', 
  'customer-account', 'reset-password', 'admin-login', 'worker-login'
];

// Handle all HTML routes without .html extension
htmlFiles.forEach(file => {
  app.get(`/${file}`, (req, res) => {
    const filePath = path.join(PUBLIC_DIR, `${file}.html`);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('Page not found');
    }
  });
  
  app.get(`/${file}.html`, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, `${file}.html`));
  });
});

// Handle gallery alternative spelling
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'gallary.html'));
});

app.get('/gallery.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'gallary.html'));
});

app.get('/gallary.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'gallary.html'));
});

// Admin and worker specific routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});

app.get('/worker', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'worker', 'worker.html'));
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Catch-all route for any other HTML requests
app.get('*', (req, res, next) => {
  // Skip API and static routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || 
      req.path.startsWith('/admin-api/') || req.path.startsWith('/worker-api/') ||
      req.path.startsWith('/js/') || req.path.startsWith('/css/') ||
      req.path.startsWith('/admin/') || req.path.startsWith('/worker/') ||
      req.path.startsWith('/health')) {
    return next();
  }
  
  // Remove leading slash and query parameters
  let cleanPath = req.path.replace(/^\//, '').split('?')[0];
  
  // If empty, redirect to index
  if (!cleanPath) {
    return res.redirect('/');
  }
  
  // Check if the path exists as an HTML file
  const possibleFile = path.join(PUBLIC_DIR, cleanPath + '.html');
  
  if (fs.existsSync(possibleFile)) {
    console.log(`[redirect] ${req.path} → ${cleanPath}.html`);
    res.sendFile(possibleFile);
  } else {
    next();
  }
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || 
      req.path.startsWith('/admin-api/') || req.path.startsWith('/worker-api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'), (err) => {
    if (err) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>404 - Page Not Found</title>
          <style>
            body{font-family:sans-serif;text-align:center;padding:50px;background:#F9EFE5}
            h1{color:#8B4513}
            a{color:#C17B4B;text-decoration:none}
            a:hover{text-decoration:underline}
          </style>
        </head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
          <p><a href="/">← Go to Home</a></p>
        </body>
        </html>
      `);
    }
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  console.error('[error] Stack:', err.stack);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: origin not allowed' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// ── Scheduled cleanup jobs ──────────────────────────────────────────────────
const otpService = require('./services/otp.service');
setInterval(() => {
  otpService.cleanup().catch(e => console.error('[cleanup]', e.message));
}, 6 * 60 * 60 * 1000);

setInterval(() => {
  visitorService.cleanupOldData().catch(e => console.error('[cleanup]', e.message));
}, 24 * 60 * 60 * 1000);

// ── Start server ─────────────────────────────────────────────────────────────
async function listenWithFallback(startPort, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const port = startPort + i;
    try {
      await new Promise((resolve, reject) => {
        const srv = app.listen(port, '0.0.0.0', () => {
          const networkInterfaces = require('os').networkInterfaces();
          console.log(`\n✅ Server running!`);
          console.log(`📍 Local access: http://localhost:${port}`);
          
          // Find and display local network IP addresses
          for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            for (const iface of interfaces) {
              if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`📱 Mobile access: http://${iface.address}:${port}`);
              }
            }
          }
          console.log(`\n📁 Admin panel: http://localhost:${port}/admin`);
          console.log(`👷 Worker panel: http://localhost:${port}/worker`);
          console.log(`🏠 Home page: http://localhost:${port}`);
          console.log(`\n💡 Tip: You can visit pages without .html extension`);
          console.log(`   Example: http://localhost:${port}/order instead of /order.html\n`);
          resolve(srv);
        });
        srv.on('error', reject);
      });
      return;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying ${port + 1}…`);
        continue;
      }
      throw err;
    }
  }
  console.error('No available ports found');
  process.exit(1);
}

// Wait for DB initialization before starting server
async function start() {
  console.log('[server] Waiting for database initialization...');
  await db.initialize();
  console.log('[server] Database ready, starting HTTP server...');
  await listenWithFallback(Number(process.env.PORT) || 3000);
}

start().catch(e => {
  console.error('[server] Fatal error:', e);
  process.exit(1);
});

module.exports = app;