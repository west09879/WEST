'use strict';
const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const Joi        = require('joi');
const rateLimit  = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const db         = require('../db');
const otpService = require('../services/otp.service');
const emailService = require('../services/email.service');

const router = express.Router();

// ── Validation schemas ──────────────────────────────────────────────────────
const registerSchema = Joi.object({
  name:     Joi.string().min(2).max(50).required(),
  email:    Joi.string().email().lowercase().required(),
  phone:    Joi.string().pattern(/^[0-9+\-\s]+$/).optional().allow('', null),
  password: Joi.string().min(8).required()
});

const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().required()
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  otp:   Joi.string().length(6).pattern(/^\d+$/).required()
});

const resendOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().required()
});

const passwordSchema = Joi.object({
  newPassword: Joi.string().min(8).required()
});

// ── Rate limiters ───────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again later.' },
  keyGenerator: ipKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP requests. Try again later.' },
  keyGenerator: ipKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function issueTokens(payload) {
  const accessToken  = jwt.sign({ ...payload }, process.env.JWT_SECRET, { expiresIn: '2h' });
  const refreshToken = jwt.sign({ ...payload, tokenType: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

function safeCustomer(c) {
  const { passwordHash, ...safe } = c;
  return safe;
}

// ── Customer: Register ───────────────────────────────────────────────────────
router.post('/register', otpLimiter, async (req, res) => {
  try {
    console.log('[auth/register] Registration attempt:', { email: req.body.email, name: req.body.name });
    
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      console.log('[auth/register] Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email, phone, password } = value;

    // Check if email already exists
    const existing = await db.get('SELECT id, emailVerified FROM customers WHERE email = ?', [email]);
    if (existing && existing.emailVerified) {
      return res.status(409).json({ error: 'Email already registered. Please login.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    let customerId;
    
    if (existing && !existing.emailVerified) {
      // Update existing unverified account
      await db.run(
        'UPDATE customers SET name = ?, phone = ?, passwordHash = ?, emailVerified = 0, updatedAt = CURRENT_TIMESTAMP WHERE email = ?',
        [name, phone || null, passwordHash, email]
      );
      customerId = existing.id;
      console.log('[auth/register] Updated existing unverified account:', customerId);
    } else {
      // Create new account
      const result = await db.run(
        'INSERT INTO customers (name, email, phone, passwordHash, emailVerified) VALUES (?, ?, ?, ?, 0)',
        [name, email, phone || null, passwordHash]
      );
      customerId = result.lastID;
      console.log('[auth/register] Created new account:', customerId);
    }

    // Generate and send OTP
    const otp = await otpService.createOTP(customerId);
    console.log(`[auth/register] OTP for ${email}: ${otp}`);
    
    // Send OTP via email (or log to console if email not configured)
    try {
      await emailService.sendOTP(email, otp, name);
    } catch (emailErr) {
      console.log('[auth/register] Email send error (but OTP is logged):', emailErr.message);
    }

    res.status(201).json({ 
      message: 'Registration successful! Check your email for the verification code.',
      email: email,
      needsVerification: true
    });
  } catch (e) {
    console.error('[auth/register] Error:', e.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── Customer: Verify OTP ─────────────────────────────────────────────────────
router.post('/verify-otp', otpLimiter, async (req, res) => {
  try {
    console.log('[auth/verify-otp] Verification attempt:', { email: req.body.email });
    
    const { error, value } = verifyOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, otp } = value;

    const customer = await db.get('SELECT * FROM customers WHERE email = ?', [email]);
    if (!customer) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    if (customer.emailVerified) {
      return res.status(400).json({ error: 'Email already verified. Please login.' });
    }

    try {
      await otpService.verifyOTP(customer.id, otp);
      
      // Send welcome email after successful verification
      try {
        await emailService.sendWelcome(email, customer.name);
      } catch (err) {
        console.log('[auth/verify-otp] Welcome email error:', err.message);
      }
      
      console.log(`[auth/verify-otp] User ${email} verified successfully`);
      res.json({ message: 'Email verified! You can now sign in.' });
    } catch (verifyError) {
      console.log('[auth/verify-otp] Verification failed:', verifyError.message);
      res.status(400).json({ error: verifyError.message });
    }
  } catch (e) {
    console.error('[auth/verify-otp] Error:', e.message);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ── Customer: Resend OTP ─────────────────────────────────────────────────────
router.post('/resend-otp', otpLimiter, async (req, res) => {
  try {
    console.log('[auth/resend-otp] Resend attempt:', { email: req.body.email });
    
    const { error, value } = resendOtpSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email } = value;
    const customer = await db.get('SELECT * FROM customers WHERE email = ?', [email]);
    
    if (!customer) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    if (customer.emailVerified) {
      return res.status(400).json({ error: 'Email already verified. Please login.' });
    }

    const otp = await otpService.resendOTP(customer.id);
    console.log(`[auth/resend-otp] New OTP for ${email}: ${otp}`);
    
    try {
      await emailService.sendOTP(email, otp, customer.name);
    } catch (emailErr) {
      console.log('[auth/resend-otp] Email error:', emailErr.message);
    }
    
    res.json({ message: 'New verification code sent to your email.' });
  } catch (e) {
    console.error('[auth/resend-otp] Error:', e.message);
    res.status(400).json({ error: e.message || 'Failed to resend code. Please try again.' });
  }
});

// ── Customer: Login ──────────────────────────────────────────────────────────
router.post('/customer/login', loginLimiter, async (req, res) => {
  try {
    console.log('[auth/login] Login attempt:', { email: req.body?.email });
    
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;
    const customer = await db.get('SELECT * FROM customers WHERE email = ?', [email]);

    if (!customer) {
      console.log('[auth/login] User not found:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!passwordMatch) {
      console.log('[auth/login] Password mismatch for:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!customer.emailVerified) {
      console.log('[auth/login] Email not verified:', email);
      return res.status(403).json({ 
        error: 'Please verify your email first', 
        needsVerification: true, 
        email 
      });
    }

    if (!customer.isActive) {
      return res.status(403).json({ error: 'Account suspended. Contact support.' });
    }

    const payload = { id: customer.id, email: customer.email, name: customer.name, role: 'customer' };
    const { accessToken, refreshToken } = issueTokens(payload);

    // Store refresh token hash
    const tokenHash  = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.run(
      'INSERT INTO refresh_tokens (customerId, tokenHash, expiresAt) VALUES (?, ?, ?)',
      [customer.id, tokenHash, expiresAt]
    );

    console.log(`[auth/login] User ${email} logged in successfully`);
    
    res.json({ 
      message: 'Login successful', 
      accessToken, 
      refreshToken, 
      customer: safeCustomer(customer) 
    });
  } catch (e) {
    console.error('[auth/customer/login] Error:', e.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── Customer: Refresh token ──────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.tokenType !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored    = await db.get(
      'SELECT * FROM refresh_tokens WHERE tokenHash = ? AND revoked = 0 AND expiresAt > ?',
      [tokenHash, new Date().toISOString()]
    );
    if (!stored) return res.status(401).json({ error: 'Token revoked or expired' });

    const payload = { id: decoded.id, email: decoded.email, name: decoded.name, role: 'customer' };
    const { accessToken, refreshToken: newRefresh } = issueTokens(payload);

    // Rotate refresh token
    const newHash      = crypto.createHash('sha256').update(newRefresh).digest('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [stored.id]);
    await db.run(
      'INSERT INTO refresh_tokens (customerId, tokenHash, expiresAt) VALUES (?, ?, ?)',
      [decoded.id, newHash, newExpiresAt]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (e) {
    console.error('[auth/refresh] Error:', e.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ── Customer: Logout ─────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE tokenHash = ?', [tokenHash]);
    }
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

// ── Customer: Get/Update profile ─────────────────────────────────────────────
const customerAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    if (decoded.role !== 'customer') return res.status(403).json({ error: 'Forbidden' });
    req.customer = decoded;
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    res.status(401).json({ error: 'Invalid or expired token', code });
  }
};

router.get('/me', customerAuth, async (req, res) => {
  try {
    const c = await db.get('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(safeCustomer(c));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/me', customerAuth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    await db.run(
      'UPDATE customers SET name = ?, phone = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [name, phone || null, req.customer.id]
    );
    const updated = await db.get('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
    res.json(safeCustomer(updated));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/me/password', customerAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields required' });

    const { error } = passwordSchema.validate({ newPassword });
    if (error) return res.status(400).json({ details: error.details });

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
    if (!customer) return res.status(404).json({ error: 'Not found' });

    const ok = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE customers SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [hash, customer.id]);

    // Revoke all refresh tokens
    await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE customerId = ?', [customer.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Customer: Forgot Password ────────────────────────────────────────────────
router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const customer = await db.get('SELECT * FROM customers WHERE email = ?', [email.toLowerCase()]);
    // Always return same message (no email enumeration)
    if (!customer) return res.json({ message: 'If registered, a reset link has been sent.' });

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.run('DELETE FROM password_resets WHERE email = ?', [email]);
    await db.run(
      'INSERT INTO password_resets (email, tokenHash, expiresAt) VALUES (?, ?, ?)',
      [email.toLowerCase(), tokenHash, expiresAt]
    );

    const appUrl    = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const resetLink = `${appUrl}/reset-password.html?token=${rawToken}`;
    
    try {
      await emailService.sendPasswordReset(email, resetLink, customer.name);
    } catch (emailErr) {
      console.log('[auth/forgot-password] Email error:', emailErr.message);
    }

    res.json({ message: 'If registered, a reset link has been sent.' });
  } catch (e) {
    console.error('[auth/forgot-password] Error:', e.message);
    res.json({ message: 'If registered, a reset link has been sent.' });
  }
});

// ── Customer: Reset Password ─────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });

    const { error } = passwordSchema.validate({ newPassword });
    if (error) return res.status(400).json({ details: error.details });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = await db.get(
      `SELECT * FROM password_resets WHERE tokenHash = ? AND used = 0 AND expiresAt > datetime('now')`,
      [tokenHash]
    );
    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE customers SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE email = ?', [hash, reset.email]);
    await db.run('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

    // Revoke all sessions
    const customer = await db.get('SELECT id FROM customers WHERE email = ?', [reset.email]);
    if (customer) await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE customerId = ?', [customer.id]);

    res.json({ message: 'Password reset successful. You can now sign in.' });
  } catch (e) {
    console.error('[auth/reset-password] Error:', e.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ── Admin: Login ─────────────────────────────────────────────────────────────
router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const admin = await db.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (e) {
    console.error('[auth/admin/login] Error:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Worker: Login ─────────────────────────────────────────────────────────────
router.post('/worker/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const worker = await db.get('SELECT * FROM workers WHERE username = ? AND isActive = 1', [username]);
    if (!worker || !(await bcrypt.compare(password, worker.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: worker.id, username: worker.username, name: worker.name, role: 'worker' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ message: 'Login successful', token, worker: { id: worker.id, name: worker.name, username: worker.username } });
  } catch (e) {
    console.error('[auth/worker/login] Error:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;