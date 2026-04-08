// test-service.js
try {
  const productionService = require('./services/production.service');
  console.log('Service loaded successfully');
  console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(productionService)).filter(name => name !== 'constructor'));
} catch (error) {
  console.error('Error loading service:', error);
}