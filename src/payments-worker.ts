import https from 'https';
import http from 'http';
import { CONSTANTS, Settings } from './properties.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

    const signString = `${Settings.anypay.project}:${body.amount}:${body.pay_id}:${Settings.anypay.token}`;
    const sign = crypto.createHash('md5').update(signString).digest('hex');

    //debug
    console.log(sign, body.sign);

    if (sign !== body.sign) {
      throw new Error('Wrong sign');
    }

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
