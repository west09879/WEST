const db = require('./db');

(async () => {
  try {
    await db.run('DELETE FROM gallery');
    await db.run('DELETE FROM orders');

    await db.run('INSERT INTO gallery (title, imageUrl, description, category, price) VALUES (?, ?, ?, ?, ?)', ['Sunset', '/images/sunset.jpg', 'Beautiful sunset', 'wedding', 10]);
    await db.run('INSERT INTO gallery (title, imageUrl, description, category, price) VALUES (?, ?, ?, ?, ?)', ['Mountains', '/images/mountains.jpg', 'Snowy peaks', 'birthday', 15]);

    await db.run('INSERT INTO orders (customerName, email, items, total) VALUES (?, ?, ?, ?)', ['Alice', 'alice@example.com', JSON.stringify([{ id: 1, title: 'Sunset', price: 10, qty: 1 }]), 10]);
    await db.run('INSERT INTO orders (customerName, email, items, total) VALUES (?, ?, ?, ?)', ['Bob', 'bob@example.com', JSON.stringify([{ id: 2, title: 'Mountains', price: 15, qty: 2 }]), 30]);

    // Ensure an admin user exists (default: admin/password) - stored hashed
    const bcrypt = require('bcryptjs');
    const existing = await db.get('SELECT * FROM admins WHERE username = ?', ['admin']);
    if (!existing) {
      const hash = await bcrypt.hash('password', 10);
      await db.run('INSERT INTO admins (username, passwordHash) VALUES (?, ?)', ['admin', hash]);
      console.log('Created default admin: admin / password');
    }

    console.log('Seeded sample data');
    process.exit(0);
  } catch (e) {
    console.error('Failed to seed:', e);
    process.exit(1);
  }
})();
