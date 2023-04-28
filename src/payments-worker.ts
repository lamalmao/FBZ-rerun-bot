import https from 'https';
import http from 'http';
import { CONSTANTS } from './properties.js';
import fs from 'fs';
import path from 'path';

const ALLOWED_IPS = ['185.162.128.38', '185.162.128.39', '185.162.128.88'];

async function paymentListener(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const remote = req.socket?.remoteAddress;
    if (!ALLOWED_IPS.includes(remote ? remote : 'unknown')) {
      throw new Error('Access declined');
    }

    const method = req.method ? req.method.toLowerCase() : 'unknown';
    if (method !== 'post') {
      throw new Error('Unsupported method');
    }

    const data: any = [];
    req
      .on('data', (chunk) => {
        data.push(chunk);
      })
      .on('error', (err) => {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            message: err.message
          })
        );
      })
      .on('end', () => {
        try {
          const body: {
            amount: number;
            status: string;
            test: 0 | 1;
            completion_date: string;
            pay_id: number;
          } = JSON.parse(Buffer.concat(data).toString());
          console.log(body);
        } catch (error: any) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              message: error.message
            })
          );
        }
      });
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
