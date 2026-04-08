// server/middleware/visitor.middleware.js
'use strict';

const visitorService = require('../services/visitor.service');
const crypto = require('crypto');

// Generate a session ID
function generateSessionId(req) {
  let sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    sessionId = crypto.randomBytes(32).toString('hex');
  }
  return sessionId;
}

// Visitor tracking middleware
async function trackVisitor(req, res, next) {
  // Skip tracking for admin and worker APIs to avoid clutter
  const skipPaths = ['/admin-api', '/worker-api', '/health', '/js/', '/css/', '/images/', '/favicon.ico'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  // Get client IP (handle proxies)
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) ip = ip.split(',')[0];
  if (ip === '::1') ip = '127.0.0.1';
  
  // Generate session ID
  const sessionId = generateSessionId(req);
  
  // Set session cookie
  res.cookie('sessionId', sessionId, {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  });
  
  // Track visitor asynchronously (don't wait for DB)
  visitorService.trackVisitor({
    ip: ip,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    page: req.path,
    method: req.method,
    sessionId: sessionId,
    userId: req.user?.id || null
  }).catch(err => console.error('[VisitorMiddleware] Error:', err));
  
  next();
}

module.exports = trackVisitor;