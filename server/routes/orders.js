const express = require('express');
const db = require('../db');
const { verifyCustomerToken, verifyAdminOrWorker, optionalAuth } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validation.middleware');

const router = express.Router();

// ─── Customer Routes ───────────────────────────────────────────────────────────

/**
 * GET /orders/my-orders
 * Returns all orders for the authenticated customer.
 */
router.get('/my-orders', verifyCustomerToken, async (req, res) => {
    try {
        const orders = await db.all(
            `SELECT id, customerName, email, phone, items, total,
                    deliveryDate, deliveryAddress, specialInstructions,
                    status, createdAt
             FROM orders
             WHERE customerId = ?
             ORDER BY createdAt DESC`,
            [req.customer.id]
        );

        orders.forEach(o => { 
          try { 
            o.items = JSON.parse(o.items); 
          } catch (e) { 
            console.error('JSON parse error:', e);
            o.items = []; 
          }
        });
        res.json(orders);
    } catch (err) {
        console.error('GET /my-orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

/**
 * GET /orders/:id
 * Returns a single order. Customers can only view their own.
 */
router.get('/:id', verifyCustomerToken, async (req, res) => {
    try {
        const order = await db.get(
            `SELECT id, customerName, email, phone, items, total,
                    deliveryDate, deliveryAddress, specialInstructions,
                    status, createdAt
             FROM orders
             WHERE id = ? AND customerId = ?`,
            [req.params.id, req.customer.id]
        );

        if (!order) return res.status(404).json({ error: 'Order not found' });

        try {
          order.items = JSON.parse(order.items);
        } catch (e) {
          console.error('JSON parse error:', e);
          order.items = [];
        }
        res.json(order);
    } catch (err) {
        console.error('GET /orders/:id:', err);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

/**
 * POST /orders
 * Creates a new order. Auth is optional — if authenticated the customer ID
 * is taken from the token (ignoring any customerId in the body).
 */
router.post('/', optionalAuth, validate(schemas.createOrder), async (req, res) => {
    try {
        const {
            customerName,
            email,
            phone,
            items,
            deliveryDate,
            deliveryAddress,
            specialInstructions
        } = req.body;

        // Authenticated customer always owns their order
        const customerId = req.customer?.id ?? null;

        // Compute total server-side — never trust client-submitted totals
        const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
        if (total <= 0) {
            return res.status(400).json({ error: 'Order total must be greater than zero' });
        }

        const result = await db.run(
            `INSERT INTO orders
                (customerId, customerName, email, phone, items, total,
                 deliveryDate, deliveryAddress, specialInstructions, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                customerId,
                customerName,
                email,
                phone   ?? null,
                JSON.stringify(items),
                total,
                deliveryDate        ?? null,
                deliveryAddress     ?? null,
                specialInstructions ?? null
            ]
        );

        const newOrder = await db.get('SELECT * FROM orders WHERE id = ?', [result.lastID]);
        newOrder.items = JSON.parse(newOrder.items);

        // Uncomment once email service is ready:
        // await emailService.sendOrderConfirmation(email, newOrder);

        res.status(201).json({ message: 'Order created successfully', order: newOrder });
    } catch (err) {
        console.error('POST /orders:', err);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

/**
 * POST /orders/:id/cancel
 * Cancels an order. Only the owning customer may cancel, and only
 * while status is 'pending'.
 */
router.post('/:id/cancel', verifyCustomerToken, async (req, res) => {
    try {
        const order = await db.get(
            'SELECT id, status, customerId FROM orders WHERE id = ? AND customerId = ?',
            [req.params.id, req.customer.id]
        );

        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.status !== 'pending') {
            return res.status(400).json({
                error: `Order cannot be cancelled (current status: ${order.status})`
            });
        }

        await db.run('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', order.id]);
        res.json({ message: 'Order cancelled successfully' });
    } catch (err) {
        console.error('POST /orders/:id/cancel:', err);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// ─── Admin / Worker Routes ─────────────────────────────────────────────────────

/**
 * PATCH /orders/:id/status
 * Updates order status. Restricted to admin and worker roles.
 */
router.patch('/:id/status', verifyAdminOrWorker, validate(schemas.updateStatus), async (req, res) => {
    try {
        const result = await db.run(
            'UPDATE orders SET status = ? WHERE id = ?',
            [req.body.status, req.params.id]
        );

        if (result.changes === 0) return res.status(404).json({ error: 'Order not found' });

        const updated = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        updated.items = JSON.parse(updated.items);
        res.json(updated);
    } catch (err) {
        console.error('PATCH /orders/:id/status:', err);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

/**
 * GET /orders
 * Returns all orders. Restricted to admin and worker roles.
 */
router.get('/', verifyAdminOrWorker, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const safePage  = Math.max(1, parseInt(page)  || 1);
        const safeLimit = Math.min(100, parseInt(limit) || 20);
        const offset    = (safePage - 1) * safeLimit;

        const conditions = status ? ['status = ?'] : [];
        const params     = status ? [status] : [];

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [orders, countRow] = await Promise.all([
            db.all(
                `SELECT * FROM orders ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
                [...params, safeLimit, offset]
            ),
            db.get(`SELECT COUNT(*) AS total FROM orders ${where}`, params)
        ]);

        orders.forEach(o => { o.items = JSON.parse(o.items); });

        res.json({
            orders,
            pagination: {
                total: countRow.total,
                page: safePage,
                limit: safeLimit,
                pages: Math.ceil(countRow.total / safeLimit)
            }
        });
    } catch (err) {
        console.error('GET /orders:', err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

module.exports = router;