'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db     = require('../db');

class OTPService {
  // ── Generate cryptographically secure 6-digit OTP ──────────────────────────
  generate() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // ── Create OTP: delete old ones, hash, store ────────────────────────────────
  async createOTP(customerId) {
    // Invalidate any pending OTPs for this customer
    await db.run(
      'DELETE FROM email_verifications WHERE customerId = ? AND verified = 0',
      [customerId]
    );

    const otp      = this.generate();
    const otpHash  = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.run(
      'INSERT INTO email_verifications (customerId, otpHash, expiresAt) VALUES (?, ?, ?)',
      [customerId, otpHash, expiresAt]
    );

    console.log(`[OTP] Created OTP for customer ${customerId}: ${otp}`);
    return otp;
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  async verifyOTP(customerId, otp) {
    // Get the latest unverified, non-expired record
    const record = await db.get(
      `SELECT * FROM email_verifications
       WHERE customerId = ? AND verified = 0 AND expiresAt > datetime('now')
       ORDER BY createdAt DESC LIMIT 1`,
      [customerId]
    );

    if (!record) {
      // Check if there's an expired record to give better error message
      const expiredRecord = await db.get(
        'SELECT expiresAt FROM email_verifications WHERE customerId = ? AND verified = 0 ORDER BY createdAt DESC LIMIT 1',
        [customerId]
      );
      if (expiredRecord) {
        throw new Error('OTP has expired. Please request a new one.');
      }
      throw new Error('No pending verification found. Please request a new OTP.');
    }

    // Enforce per-record attempt limit to prevent brute force
    if (record.attempts >= 5) {
      await db.run('DELETE FROM email_verifications WHERE id = ?', [record.id]);
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }

    // Increment attempt counter
    await db.run(
      'UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?',
      [record.id]
    );

    const isValid = await bcrypt.compare(otp, record.otpHash);
    if (!isValid) {
      const remaining = 5 - (record.attempts + 1);
      throw new Error(
        remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Invalid OTP. No attempts remaining — please request a new one.'
      );
    }

    // Mark verified and activate customer
    await db.run('UPDATE email_verifications SET verified = 1 WHERE id = ?', [record.id]);
    await db.run('UPDATE customers SET emailVerified = 1 WHERE id = ?', [customerId]);

    console.log(`[OTP] Customer ${customerId} verified successfully`);
    return true;
  }

  // ── Resend OTP with rate limit ───────────────────────────────────────────────
  async resendOTP(customerId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const row = await db.get(
      'SELECT COUNT(*) AS cnt FROM email_verifications WHERE customerId = ? AND createdAt > ?',
      [customerId, oneHourAgo]
    );

    if ((row?.cnt ?? 0) >= 3) {
      throw new Error('Too many OTP requests. Please wait before trying again.');
    }

    return this.createOTP(customerId);
  }

  // ── Cleanup expired records ──────────────────────────────────────────────────
  async cleanup() {
    const now = new Date().toISOString();
    const r1  = await db.run('DELETE FROM email_verifications WHERE expiresAt < ?', [now]);
    const r2  = await db.run('DELETE FROM password_resets WHERE expiresAt < ?', [now]);
    const r3  = await db.run(
      'DELETE FROM login_attempts WHERE createdAt < ?',
      [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]
    );
    console.log(`[OTP] Cleanup: ${r1.changes} expired OTPs, ${r2.changes} resets, ${r3.changes} attempt logs removed`);
  }
}

module.exports = new OTPService();