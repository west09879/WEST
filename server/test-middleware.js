// test-middleware.js
try {
  const { verifyWorkerToken } = require('./middleware/auth.middleware');
  console.log('Middleware loaded successfully');
  console.log('verifyWorkerToken type:', typeof verifyWorkerToken);
} catch (error) {
  console.error('Error loading middleware:', error);
}