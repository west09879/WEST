require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const galleryRoutes = require('./routes/gallery');
const ordersRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/worker');

const app = express();
app.use(cors());
app.use(express.json());

// Simple request logger to help debug static file serving
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

app.use('/api/gallery', galleryRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/auth', authRoutes);
app.use('/admin-api', adminRoutes);
app.use('/worker-api', workerRoutes);

// Serve the admin UI
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve worker UI
app.use('/worker', express.static(path.join(__dirname, 'worker')));

// Explicit route to ensure worker page is served even if static middleware misses it
app.get('/worker/worker.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'worker', 'worker.html'));
});
app.get('/worker', (req, res) => res.redirect('/worker/worker.html'));

// Serve the frontend (the parent folder contains your html files)
app.use(express.static(path.join(__dirname, '..')));

// Basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

// Try to bind to DEFAULT_PORT, if in use try next ports up to a limit
async function listenWithFallback(startPort, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const port = startPort + i;
    try {
      await new Promise((resolve, reject) => {
        const srv = app.listen(port, () => {
          console.log(`Server listening on http://localhost:${port}`);
          resolve(srv);
        });
        srv.on('error', (err) => {
          reject(err);
        });
      });
      return;
    } catch (err) {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying ${port + 1}...`);
        continue;
      }
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  }
  console.error('No available ports found');
  process.exit(1);
}

listenWithFallback(DEFAULT_PORT, 20).catch(e => { console.error(e); process.exit(1); });
