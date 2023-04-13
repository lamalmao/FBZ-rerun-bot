import http, { IncomingMessage, ServerResponse } from 'http';
import { errorLogger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { CONSTANTS } from './properties.js';

function ImageHostListener(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!req.url) {
      throw new Error('No url provided');
    }

    const image = path.join(CONSTANTS.IMAGES, req.url.slice(1) + '.jpg');
    if (!fs.existsSync(image)) {
      throw new Error('Image not found');
    }

    res.writeHead(200, {
      'Content-Type': 'image/jpg'
    });
    const imageFile = fs.createReadStream(image);
    imageFile.pipe(res);
  } catch (e: any) {
    errorLogger.error(e.message);
    res.statusCode = 404;
    res.end();
  }
}

export const ImageHost = http.createServer(ImageHostListener);
