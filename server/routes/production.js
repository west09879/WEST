// production.js - Production workflow routes

'use strict';

const express = require('express');
const router = express.Router();
const productionService = require('../services/production.service');
const { verifyWorkerToken } = require('../middleware/auth.middleware');

// Baking routes
router.get('/baking/queue', verifyWorkerToken, async (req, res) => {
  try {
    const tasks = await productionService.getBakingQueue(req.worker.id);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Baking queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/baking/:taskId/claim', verifyWorkerToken, async (req, res) => {
  try {
    const result = await productionService.claimBakingTask(req.params.taskId, req.worker.id, req.worker.name);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Claim baking task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/baking/:taskId/complete', verifyWorkerToken, async (req, res) => {
  try {
    const result = await productionService.completeBakingTask(req.params.taskId);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Complete baking task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Design routes
router.get('/design/queue', verifyWorkerToken, async (req, res) => {
  try {
    const tasks = await productionService.getDesignQueue(req.worker.id);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Design queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/design/:taskId/claim', verifyWorkerToken, async (req, res) => {
  try {
    const result = await productionService.claimDesignTask(req.params.taskId, req.worker.id, req.worker.name);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Claim design task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/design/:taskId/complete', verifyWorkerToken, async (req, res) => {
  try {
    const result = await productionService.completeDesignTask(req.params.taskId);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Complete design task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delivery routes
router.get('/delivery/queue', verifyWorkerToken, async (req, res) => {
  try {
    const tasks = await productionService.getDeliveryQueue(req.worker.id);
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Delivery queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/delivery/:taskId/claim', verifyWorkerToken, async (req, res) => {
  try {
    const result = await productionService.claimDeliveryTask(req.params.taskId, req.worker.id, req.worker.name);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Claim delivery task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/delivery/:taskId/complete', verifyWorkerToken, async (req, res) => {
  try {
    const result = await productionService.completeDeliveryTask(req.params.taskId);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Complete delivery task error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;