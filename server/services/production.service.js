// production.service.js - Production workflow management

const db = require('../db');

class ProductionService {
  // Get baking queue for a worker
  async getBakingQueue(workerId) {
    try {
      const query = `
        SELECT o.id as order_id, o.customer_name, o.customer_phone, o.delivery_address, o.delivery_zone,
               o.status, o.created_at, o.delivery_date,
               GROUP_CONCAT(
                 JSON_OBJECT(
                   'id', oi.id,
                   'title', oi.title,
                   'qty', oi.quantity,
                   'price', oi.price
                 )
               ) as items_json,
               pt.id, pt.status, pt.assigned_to, pt.baking_notes, pt.sponge_type, pt.cake_shape, pt.pan_size, pt.layers
        FROM production_tasks pt
        JOIN orders o ON pt.order_id = o.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE pt.task_type = 'baking' AND (pt.status = 'pending' OR (pt.status = 'in_progress' AND pt.assigned_to = ?))
        GROUP BY pt.id
        ORDER BY pt.created_at ASC
      `;
      const [rows] = await db.execute(query, [workerId]);
      
      return rows.map(row => ({
        id: row.id,
        order_id: row.order_id,
        status: row.status,
        assigned_to: row.assigned_to,
        customerName: row.customer_name,
        customer_phone: row.customer_phone,
        delivery_address: row.delivery_address,
        delivery_zone: row.delivery_zone,
        items: row.items_json ? JSON.parse(`[${row.items_json}]`) : [],
        baking_notes: row.baking_notes,
        sponge_type: row.sponge_type,
        cake_shape: row.cake_shape,
        pan_size: row.pan_size,
        layers: row.layers,
        created_at: row.created_at
      }));
    } catch (error) {
      console.error('Error getting baking queue:', error);
      throw new Error('Failed to get baking queue');
    }
  }

  // Claim baking task
  async claimBakingTask(taskId, workerId, workerName) {
    try {
      // Check if task exists and is available
      const [existing] = await db.execute(
        'SELECT id, status, assigned_to FROM production_tasks WHERE id = ? AND task_type = "baking"',
        [taskId]
      );
      
      if (!existing.length) {
        return { success: false, error: 'Task not found' };
      }
      
      const task = existing[0];
      if (task.status !== 'pending') {
        return { success: false, error: 'Task already claimed or completed' };
      }
      
      // Update task
      await db.execute(
        'UPDATE production_tasks SET status = "in_progress", assigned_to = ?, assigned_at = NOW() WHERE id = ?',
        [workerName, taskId]
      );
      
      // Update order status
      await db.execute(
        'UPDATE orders SET status = "preparing", updated_at = NOW() WHERE id = (SELECT order_id FROM production_tasks WHERE id = ?)',
        [taskId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error claiming baking task:', error);
      throw new Error('Failed to claim baking task');
    }
  }

  // Complete baking task
  async completeBakingTask(taskId) {
    try {
      // Check if task exists and is in progress
      const [existing] = await db.execute(
        'SELECT id, status, order_id FROM production_tasks WHERE id = ? AND task_type = "baking"',
        [taskId]
      );
      
      if (!existing.length) {
        return { success: false, error: 'Task not found' };
      }
      
      const task = existing[0];
      if (task.status !== 'in_progress') {
        return { success: false, error: 'Task not in progress' };
      }
      
      // Update task
      await db.execute(
        'UPDATE production_tasks SET status = "completed", completed_at = NOW() WHERE id = ?',
        [taskId]
      );
      
      // Create design task
      await db.execute(
        'INSERT INTO production_tasks (order_id, task_type, status, created_at) VALUES (?, "design", "pending", NOW())',
        [task.order_id]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error completing baking task:', error);
      throw new Error('Failed to complete baking task');
    }
  }

  // Get design queue for a worker
  async getDesignQueue(workerId) {
    try {
      const query = `
        SELECT o.id as order_id, o.customer_name, o.customer_phone, o.delivery_address, o.delivery_zone,
               o.status, o.created_at, o.delivery_date,
               GROUP_CONCAT(
                 JSON_OBJECT(
                   'id', oi.id,
                   'title', oi.title,
                   'qty', oi.quantity,
                   'price', oi.price
                 )
               ) as items_json,
               pt.id, pt.status, pt.assigned_to, pt.icing_type, pt.icing_color, pt.topper_type, pt.writing_text, pt.design_reference
        FROM production_tasks pt
        JOIN orders o ON pt.order_id = o.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE pt.task_type = 'design' AND (pt.status = 'pending' OR (pt.status = 'in_progress' AND pt.assigned_to = ?))
        GROUP BY pt.id
        ORDER BY pt.created_at ASC
      `;
      const [rows] = await db.execute(query, [workerId]);
      
      return rows.map(row => ({
        id: row.id,
        order_id: row.order_id,
        status: row.status,
        assigned_to: row.assigned_to,
        customerName: row.customer_name,
        customer_phone: row.customer_phone,
        delivery_address: row.delivery_address,
        delivery_zone: row.delivery_zone,
        items: row.items_json ? JSON.parse(`[${row.items_json}]`) : [],
        icing_type: row.icing_type,
        icing_color: row.icing_color,
        topper_type: row.topper_type,
        writing_text: row.writing_text,
        design_reference: row.design_reference,
        created_at: row.created_at
      }));
    } catch (error) {
      console.error('Error getting design queue:', error);
      throw new Error('Failed to get design queue');
    }
  }

  // Claim design task
  async claimDesignTask(taskId, workerId, workerName) {
    try {
      const [existing] = await db.execute(
        'SELECT id, status FROM production_tasks WHERE id = ? AND task_type = "design"',
        [taskId]
      );
      
      if (!existing.length) {
        return { success: false, error: 'Task not found' };
      }
      
      const task = existing[0];
      if (task.status !== 'pending') {
        return { success: false, error: 'Task already claimed or completed' };
      }
      
      await db.execute(
        'UPDATE production_tasks SET status = "in_progress", assigned_to = ?, assigned_at = NOW() WHERE id = ?',
        [workerName, taskId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error claiming design task:', error);
      throw new Error('Failed to claim design task');
    }
  }

  // Complete design task
  async completeDesignTask(taskId) {
    try {
      const [existing] = await db.execute(
        'SELECT id, status, order_id FROM production_tasks WHERE id = ? AND task_type = "design"',
        [taskId]
      );
      
      if (!existing.length) {
        return { success: false, error: 'Task not found' };
      }
      
      const task = existing[0];
      if (task.status !== 'in_progress') {
        return { success: false, error: 'Task not in progress' };
      }
      
      await db.execute(
        'UPDATE production_tasks SET status = "completed", completed_at = NOW() WHERE id = ?',
        [taskId]
      );
      
      // Create delivery task
      await db.execute(
        'INSERT INTO production_tasks (order_id, task_type, status, created_at) VALUES (?, "delivery", "pending", NOW())',
        [task.order_id]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error completing design task:', error);
      throw new Error('Failed to complete design task');
    }
  }

  // Get delivery queue for a worker
  async getDeliveryQueue(workerId) {
    try {
      const query = `
        SELECT o.id as order_id, o.customer_name, o.customer_phone, o.delivery_address, o.delivery_zone,
               o.status, o.created_at, o.delivery_date,
               GROUP_CONCAT(
                 JSON_OBJECT(
                   'id', oi.id,
                   'title', oi.title,
                   'qty', oi.quantity,
                   'price', oi.price
                 )
               ) as items_json,
               pt.id, pt.status, pt.assigned_to, pt.special_handling
        FROM production_tasks pt
        JOIN orders o ON pt.order_id = o.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE pt.task_type = 'delivery' AND (pt.status = 'pending' OR (pt.status = 'in_progress' AND pt.assigned_to = ?))
        GROUP BY pt.id
        ORDER BY pt.created_at ASC
      `;
      const [rows] = await db.execute(query, [workerId]);
      
      return rows.map(row => ({
        id: row.id,
        order_id: row.order_id,
        status: row.status,
        assigned_to: row.assigned_to,
        customerName: row.customer_name,
        customer_phone: row.customer_phone,
        delivery_address: row.delivery_address,
        delivery_zone: row.delivery_zone,
        items: row.items_json ? JSON.parse(`[${row.items_json}]`) : [],
        special_handling: row.special_handling,
        created_at: row.created_at
      }));
    } catch (error) {
      console.error('Error getting delivery queue:', error);
      throw new Error('Failed to get delivery queue');
    }
  }

  // Claim delivery task
  async claimDeliveryTask(taskId, workerId, workerName) {
    try {
      const [existing] = await db.execute(
        'SELECT id, status FROM production_tasks WHERE id = ? AND task_type = "delivery"',
        [taskId]
      );
      
      if (!existing.length) {
        return { success: false, error: 'Task not found' };
      }
      
      const task = existing[0];
      if (task.status !== 'pending') {
        return { success: false, error: 'Task already claimed or completed' };
      }
      
      await db.execute(
        'UPDATE production_tasks SET status = "in_progress", assigned_to = ?, assigned_at = NOW() WHERE id = ?',
        [workerName, taskId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error claiming delivery task:', error);
      throw new Error('Failed to claim delivery task');
    }
  }

  // Complete delivery task
  async completeDeliveryTask(taskId) {
    try {
      const [existing] = await db.execute(
        'SELECT id, status, order_id FROM production_tasks WHERE id = ? AND task_type = "delivery"',
        [taskId]
      );
      
      if (!existing.length) {
        return { success: false, error: 'Task not found' };
      }
      
      const task = existing[0];
      if (task.status !== 'in_progress') {
        return { success: false, error: 'Task not in progress' };
      }
      
      await db.execute(
        'UPDATE production_tasks SET status = "completed", completed_at = NOW() WHERE id = ?',
        [taskId]
      );
      
      // Update order status to delivered
      await db.execute(
        'UPDATE orders SET status = "delivered", updated_at = NOW() WHERE id = ?',
        [task.order_id]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error completing delivery task:', error);
      throw new Error('Failed to complete delivery task');
    }
  }
}

module.exports = new ProductionService();