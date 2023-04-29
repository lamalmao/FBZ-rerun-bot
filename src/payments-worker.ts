import https from 'https';
import http from 'http';
import { CONSTANTS, Settings } from './properties.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Payment from './models/payments.js';
import shopBot, { CURRENCY_SIGNS } from './bots/shop/shop-bot.js';
import { errorLogger } from './logger.js';

const ALLOWED_IPS = ['185.162.128.38', '185.162.128.39', '185.162.128.88'];

async function paymentListener(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const remote = req.socket?.remoteAddress;
    if (!ALLOWED_IPS.includes(remote ? remote : 'unknown')) {
      throw new Error('Access declined');
    }

    const method = req.method ? req.method.toLowerCase() : 'unknown';
    if (method !== 'get') {
      throw new Error('Unsupported method');
    }

    const body: {
      transaction_id?: string;
      pay_id?: string;
      amount?: string;
      status?: string;
      test?: '0' | '1';
      completion_date?: string;
      sign?: string;
    } = {};

    const rawData = req.url ? req.url.substring(2).split('&') : null;
    if (!rawData) {
      throw new Error('Empty request');
    }

    for (const item of rawData) {
      const values = item.split('=');
      const key = values[0];
      const value = values[1];
      body[key] = value;
    }

    const signData: Array<string | undefined> = [
      Settings.anypay.project.toString(),
      body.amount?.toString(),
      body.pay_id?.toString(),
      Settings.anypay.token
    ];
    const signString = signData.join(':');
    const sign = crypto.createHash('md5').update(signString).digest('hex');

    if (sign !== body.sign) {
      throw new Error('Wrong sign');
    }

    if (body.status !== 'paid') {
      throw new Error('Unpaid');
    }

    const paymentId = Number(body.pay_id);
    const payment = await Payment.findOne({
      paymentId,
      status: {
        $ne: 'paid'
      }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const result = await payment.close();
    if (!result) {
      throw new Error('Payment not closed');
    }

    // prettier-ignore
    shopBot.telegram.editMessageCaption(payment.user, payment.telegramMessage, undefined, `Счёт на __${payment.price.amount} ${CURRENCY_SIGNS[payment.price.region]}__ оплачен\\.\nВаш баланс пополнен`)
      .catch(error => errorLogger.error(error.message));

    res.statusCode = 200;
    res.end('OK');
  } catch (error: any) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        message: error.message
      })
    );
  }
}

const paymentServer = https.createServer(
  {
    cert: fs.readFileSync(path.join(CONSTANTS.PROCESS_DIR, 'cert.pem')),
    key: fs.readFileSync(path.join(CONSTANTS.PROCESS_DIR, 'key.pem'))
  },
  paymentListener
);
export default paymentServer;
