'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  try {
    // Wait for DB initialization
    await db.initialize();
    console.log('[seed] Database initialized');

    // ── Gallery sample data (only if empty) ─────────────────────────────────
    const galleryCount = await db.get('SELECT COUNT(*) AS cnt FROM gallery');
    if (galleryCount.cnt === 0) {
      const items = [
        ['Sunset Wedding Cake', '/images/sunset.jpg', 'Elegant multi-tier wedding cake', 'wedding', 12500],
        ['Birthday Surprise', '/images/birthday.jpg', 'Colorful birthday celebration', 'birthday', 4500],
        ['Cultural Celebration', '/images/cultural.jpg', 'Traditional themed cake', 'cultural', 8000],
        ['Custom Creation', '/images/custom.jpg', 'Fully custom design', 'custom', 15000]
      ];
      for (const [title, imageUrl, description, category, price] of items) {
        await db.run(
          'INSERT INTO gallery (title, imageUrl, description, category, price) VALUES (?, ?, ?, ?, ?)',
          [title, imageUrl, description, category, price]
        );
      }
      console.log('✅ Gallery seeded');
    } else {
      console.log('⏭ Gallery already has data — skipping');
    }

    // ── Admin user ───────────────────────────────────────────────────────────
    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    if (adminUser && adminPass) {
      const existing = await db.get('SELECT id FROM admins WHERE username = ?', [adminUser]);
      if (!existing) {
        const hash = await bcrypt.hash(adminPass, 10);
        await db.run('INSERT INTO admins (username, passwordHash) VALUES (?, ?)', [adminUser, hash]);
        console.log(`✅ Admin created: ${adminUser}`);
      } else {
        console.log(`⏭ Admin "${adminUser}" already exists — skipping`);
      }
    } else {
      console.warn('⚠️ ADMIN_USER / ADMIN_PASS not set — no admin created');
    }

    // ── Default worker ───────────────────────────────────────────────────────
    const workerUser = process.env.WORKER_USER;
    const workerPass = process.env.WORKER_PASS;
    const workerName = process.env.WORKER_NAME || 'Default Worker';

    if (workerUser && workerPass) {
      const existing = await db.get('SELECT id FROM workers WHERE username = ?', [workerUser]);
      if (!existing) {
        const hash = await bcrypt.hash(workerPass, 10);
        await db.run(
          'INSERT INTO workers (name, username, passwordHash) VALUES (?, ?, ?)',
          [workerName, workerUser, hash]
        );
        console.log(`✅ Worker created: ${workerUser}`);
      } else {
        console.log(`⏭ Worker "${workerUser}" already exists — skipping`);
      }
    } else {
      console.warn('⚠️ WORKER_USER / WORKER_PASS not set — no worker created');
    }

    // ── Sample order (only in development, only if orders table is empty) ────
    if (process.env.NODE_ENV !== 'production') {
      const orderCount = await db.get('SELECT COUNT(*) AS cnt FROM orders');
      if (orderCount.cnt === 0) {
        await db.run(
          `INSERT INTO orders (customerName, email, items, total, status)
           VALUES (?, ?, ?, ?, ?)`,
          [
            'Alice Kariuki',
            'alice@example.com',
            JSON.stringify([{ id: 1, title: 'Sunset Wedding Cake', price: 12500, qty: 1 }]),
            12500,
            'pending'
          ]
        );
        console.log('✅ Sample order created (dev only)');
      }
    }

    console.log('\n🎉 Seed complete');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  }
})();