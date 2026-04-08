'use strict';

const Joi = require('joi');

// Validation schemas
const schemas = {
  createOrder: Joi.object({
    customerName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().allow('', null).optional(),
    items: Joi.array().items(
      Joi.object({
        id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        title: Joi.string().required(),
        price: Joi.number().positive().required(),
        qty: Joi.number().integer().min(1).required()
      })
    ).min(1).required(),
    deliveryDate: Joi.string().isoDate().allow(null).optional(),
    deliveryAddress: Joi.string().allow('', null).optional(),
    specialInstructions: Joi.string().allow('', null).optional()
  }),
  
  updateStatus: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled').required()
  })
};

// Validation middleware
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    req.body = value;
    next();
  };
}

module.exports = {
  validate,
  schemas
};