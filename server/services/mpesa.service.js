// server/services/mpesa.service.js
'use strict';

const axios = require('axios');
const moment = require('moment');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortCode = process.env.MPESA_SHORTCODE || '174379';
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

    this.baseUrl = this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Generate access token
  async getAccessToken() {
    try {
      // Check if token is still valid (5 minutes buffer)
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 3600 seconds, set expiry to 55 minutes
      this.tokenExpiry = Date.now() + (55 * 60 * 1000);

      console.log('[Mpesa] Access token generated successfully');
      return this.accessToken;
    } catch (error) {
      console.error('[Mpesa] Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  // Generate password for STK push
  generatePassword() {
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  // Format phone number to 254XXXXXXXXX
  formatPhoneNumber(phone) {
    // Remove any non-digit characters
    let cleaned = phone.toString().replace(/\D/g, '');

    // Remove leading 0 or +
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('254')) {
      // Already correct format
    } else if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.length === 9) {
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  // Initiate STK Push payment
  async stkPush(phoneNumber, amount, accountReference = 'OrderPayment', transactionDesc = 'BeFo Bakers Payment') {
    try {
      // Get access token
      const token = await this.getAccessToken();

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      // Generate password
      const { password, timestamp } = this.generatePassword();

      // Prepare request body
      const requestBody = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: this.callbackUrl,
        AccountReference: accountReference.substring(0, 12),
        TransactionDesc: transactionDesc.substring(0, 13)
      };

      console.log('[Mpesa] Initiating STK Push:', { phone: formattedPhone, amount });

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[Mpesa] STK Push response:', response.data);

      return {
        success: response.data.ResponseCode === '0',
        data: response.data
      };
    } catch (error) {
      console.error('[Mpesa] STK Push error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message
      };
    }
  }

  // Query transaction status
  async queryStatus(checkoutRequestId) {
    try {
      const token = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const requestBody = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: response.data.ResultCode === '0',
        data: response.data
      };
    } catch (error) {
      console.error('[Mpesa] Query status error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MpesaService();