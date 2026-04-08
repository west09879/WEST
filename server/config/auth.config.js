'use strict';

module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: '2h',
    refreshExpiresIn: '7d'
  },

  otp: {
    length: 6,
    expiresInMs: 10 * 60 * 1000, // 10 minutes
    maxAttempts: 5,
    maxPerHour: 3
  },

  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000,
      max: 10
    },
    otp: {
      windowMs: 60 * 60 * 1000,
      max: 5
    },
    general: {
      windowMs: 15 * 60 * 1000,
      max: 100
    }
  },

  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || '"BeFo Bakers" <noreply@befobakers.com>'
  },

  password: {
    minLength: 8,
    saltRounds: 10,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#])[A-Za-z\d@$!%*?&^#]{8,}$/
  },

  appUrl: process.env.APP_URL || 'http://localhost:3000'
};