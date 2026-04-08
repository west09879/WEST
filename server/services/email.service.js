'use strict';

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this._transporter = null;
    this._ready = false;
    this._init();
  }

  _init() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[email] 📧 Email not configured. OTP codes will be shown in console.');
      console.log('[email] To enable email, set EMAIL_USER and EMAIL_PASS in .env');
      return;
    }
    
    this._transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    this._transporter.verify((err) => {
      if (err) {
        console.warn('[email] SMTP verify failed:', err.message);
        console.warn('[email] Emails will be logged to console only');
      } else {
        this._ready = true;
        console.log('[email] ✅ SMTP ready');
      }
    });
  }

  async _send(options) {
    // Always log to console for development
    console.log(`\n📧 [EMAIL] To: ${options.to}`);
    console.log(`📧 [EMAIL] Subject: ${options.subject}`);
    console.log(`📧 [EMAIL] Body preview: ${options.html?.substring(0, 200)}...\n`);
    
    if (!this._transporter || !this._ready) {
      return true;
    }
    
    try {
      await this._transporter.sendMail({
        from: process.env.EMAIL_FROM || '"BeFo Bakers" <noreply@befobakers.com>',
        ...options
      });
      return true;
    } catch (err) {
      console.error('[email] Send error:', err.message);
      return false;
    }
  }

  async sendOTP(email, otp, name) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B4B;">Welcome to BeFo Bakers!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering. Please verify your email using the code below:</p>
        <div style="background: #F9E6D8; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #888; font-size: 12px;">BeFo Bakers - Artisan Bakery</p>
      </div>
    `;
    return this._send({ to: email, subject: 'Verify your email — BeFo Bakers', html });
  }

  async sendWelcome(email, name) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B4B;">Welcome to BeFo Bakers, ${name}! 🎉</h2>
        <p>Your email has been verified. You're officially part of our baking family!</p>
        <p>You can now:</p>
        <ul>
          <li>Browse our cake gallery</li>
          <li>Place custom cake orders</li>
          <li>Track your orders</li>
        </ul>
        <p>Visit our website to start ordering!</p>
        <hr>
        <p style="color: #888; font-size: 12px;">BeFo Bakers - Artisan Bakery</p>
      </div>
    `;
    return this._send({ to: email, subject: 'Welcome to BeFo Bakers! 🎂', html });
  }

  async sendPasswordReset(email, resetLink, name) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B4B;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #C17B4B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        </div>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #888; font-size: 12px;">BeFo Bakers - Artisan Bakery</p>
      </div>
    `;
    return this._send({ to: email, subject: 'Reset your password — BeFo Bakers', html });
  }

  async sendOrderConfirmation(email, order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map(i => `<li>${i.title || 'Item'} x ${i.qty} - KSh ${(i.price * i.qty).toLocaleString()}</li>`).join('');
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B4B;">Order Confirmed! 🎂</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your order #${order.id} has been received. Total: KSh ${Number(order.total).toLocaleString()}</p>
        <h3>Items:</h3>
        <ul>${itemsHtml}</ul>
        ${order.deliveryDate ? `<p><strong>Delivery Date:</strong> ${new Date(order.deliveryDate).toLocaleDateString()}</p>` : ''}
        ${order.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>` : ''}
        <p>We'll notify you when your order status changes.</p>
        <hr>
        <p style="color: #888; font-size: 12px;">BeFo Bakers - Artisan Bakery</p>
      </div>
    `;
    return this._send({ to: email, subject: `Order #${order.id} confirmed — BeFo Bakers`, html });
  }

  async sendStatusUpdate(email, order, newStatus) {
    const statusMessages = {
      confirmed: 'Your order has been confirmed!',
      preparing: 'Our bakers are preparing your cake!',
      ready: 'Your cake is ready! 🎉',
      delivered: 'Your order has been delivered. Enjoy!',
      cancelled: 'Your order has been cancelled.'
    };
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C17B4B;">Order Update</h2>
        <p>Hello ${order.customerName},</p>
        <p>${statusMessages[newStatus] || `Your order #${order.id} status is now: ${newStatus}`}</p>
        <p>Track your order on our website.</p>
        <hr>
        <p style="color: #888; font-size: 12px;">BeFo Bakers - Artisan Bakery</p>
      </div>
    `;
    return this._send({ to: email, subject: `Order #${order.id} Update — BeFo Bakers`, html });
  }
}

module.exports = new EmailService();