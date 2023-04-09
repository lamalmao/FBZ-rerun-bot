import winston from 'winston';
import { CONSTANTS } from './properties.js';
import path from 'path';

const errorLogsFile = path.join(CONSTANTS.LOGS, 'errors.log');
const infoLogsFile = path.join(CONSTANTS.LOGS, 'story.log');

export const errorLogger = winston.createLogger({
  level: 'error',
  transports: [
    new winston.transports.File({
      filename: errorLogsFile,
      format: winston.format.errors(),
      level: 'error'
    })
  ]
});

export const infoLogger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.File({
      filename: infoLogsFile,
      format: winston.format.json()
    })
  ]
});
