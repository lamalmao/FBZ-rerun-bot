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

    const imageFileName = req.url.slice(1) + '.jpg';
    const imageFilePath = path.join(CONSTANTS.IMAGES, req.url.slice(1) + '.jpg');
    if (!fs.existsSync(imageFilePath)) {
      throw new Error(`Image "${imageFileName}" not found`);
    }

    res.writeHead(200, {
      'Content-Type': 'image/jpg'
    });
    const imageFile = fs.createReadStream(imageFilePath);
    imageFile.pipe(res);
  } catch (e: any) {
    errorLogger.error(e.message);
    res.statusCode = 404;
    res.end();
  }
}

export const ImageHost = http.createServer(ImageHostListener);
