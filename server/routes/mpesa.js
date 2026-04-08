// server/routes/mpesa.js
'use strict';

const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesa.service');
const db = require('../db');

// Initiate STK Push payment
router.post('/stk-push', async (req, res) => {
  try {
    const { phoneNumber, amount, orderId, accountReference } = req.body;

    // Validate inputs
    if (!phoneNumber || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and amount are required'
      });
    }

    if (amount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least 1 KES'
      });
    }

    // Initiate STK Push
    const result = await mpesaService.stkPush(
      phoneNumber,
      amount,
      accountReference || `Order${orderId || Date.now()}`,
      'BeFo Bakers Payment'
    );

    if (result.success) {
      // Store transaction in database
      const transactionId = result.data.CheckoutRequestID;

      await db.run(`
        INSERT INTO mpesa_transactions
        (checkout_request_id, merchant_request_id, amount, phone_number, order_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
      `, [
        transactionId,
        result.data.MerchantRequestID,
        amount,
        mpesaService.formatPhoneNumber(phoneNumber),
        orderId || null
      ]);

      res.json({
        success: true,
        message: 'STK Push initiated. Check your phone for the M-Pesa prompt.',
        data: {
          checkoutRequestId: transactionId,
          merchantRequestId: result.data.MerchantRequestID,
          responseCode: result.data.ResponseCode,
          responseDescription: result.data.ResponseDescription
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to initiate payment'
      });
    }
  } catch (error) {
    console.error('[Mpesa Route] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// M-Pesa Callback URL (receives payment confirmation)
router.post('/callback', async (req, res) => {
  try {
    console.log('[Mpesa Callback] Received callback:', JSON.stringify(req.body, null, 2));

    const { Body } = req.body;

    if (Body && Body.stkCallback) {
      const callback = Body.stkCallback;
      const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc
      } = callback;

      // Update transaction status in database
      await db.run(`
        UPDATE mpesa_transactions
        SET status = ?, result_code = ?, result_desc = ?, updated_at = datetime('now')
        WHERE checkout_request_id = ?
      `, [
        ResultCode === 0 ? 'completed' : 'failed',
        ResultCode,
        ResultDesc,
        CheckoutRequestID
      ]);

      if (ResultCode === 0 && callback.CallbackMetadata) {
        // Payment successful - extract metadata
        try {
          const metadata = {};
          if (!Array.isArray(callback.CallbackMetadata.Item)) {
            console.error('[Mpesa] Invalid metadata structure');
            return res.json({ ResultCode: 0, ResultDesc: 'Success' });
          }
          
          callback.CallbackMetadata.Item.forEach(item => {
            metadata[item.Name] = item.Value;
          });

          // Update with payment details
          await db.run(`
            UPDATE mpesa_transactions
            SET amount = ?, mpesa_receipt = ?, transaction_date = ?
            WHERE checkout_request_id = ?
          `, [
            metadata.Amount,
            metadata.MpesaReceiptNumber,
            metadata.TransactionDate,
            CheckoutRequestID
          ]);

          // Update order status if order_id exists
          const transaction = await db.get(
            'SELECT order_id FROM mpesa_transactions WHERE checkout_request_id = ?',
            [CheckoutRequestID]
          );

          if (transaction && transaction.order_id) {
            // Verify order exists before updating
            const order = await db.get('SELECT id FROM orders WHERE id = ?', [transaction.order_id]);
            if (!order) {
              console.error(`[Mpesa] Order ${transaction.order_id} not found`);
              return res.json({ ResultCode: 0, ResultDesc: 'Success' });
            }
            
            await db.run(`
              UPDATE orders
              SET status = 'confirmed', payment_status = 'paid', updated_at = datetime('now')
              WHERE id = ?
            `, [transaction.order_id]);

            console.log(`[Mpesa] Order ${transaction.order_id} marked as paid`);
          }

          console.log(`[Mpesa] Payment successful: ${metadata.MpesaReceiptNumber} - KES ${metadata.Amount}`);
        } catch (parseErr) {
          console.error('[Mpesa] Error processing metadata:', parseErr);
        }
      } else {
        console.log(`[Mpesa] Payment failed: ${ResultDesc}`);
      }
    }

    // Always respond with success to M-Pesa
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('[Mpesa Callback] Error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

// Query transaction status
router.get('/status/:checkoutRequestId', async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const transaction = await db.get(
      'SELECT * FROM mpesa_transactions WHERE checkout_request_id = ?',
      [checkoutRequestId]
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // If status is still pending, query M-Pesa for update
    if (transaction.status === 'pending') {
      const result = await mpesaService.queryStatus(checkoutRequestId);

      if (result.success) {
        await db.run(`
          UPDATE mpesa_transactions
          SET status = ?, result_code = ?, result_desc = ?, updated_at = datetime('now')
          WHERE checkout_request_id = ?
        `, [
          result.data.ResultCode === '0' ? 'completed' : 'failed',
          result.data.ResultCode,
          result.data.ResultDesc,
          checkoutRequestId
        ]);

        transaction.status = result.data.ResultCode === '0' ? 'completed' : 'failed';
      }
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('[Mpesa Status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;