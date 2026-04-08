'use strict';
// Generic Joi validation middleware
module.exports = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
  if (error) return res.status(400).json({ error: error.details[0].message });
  req.body = value;
  next();
};