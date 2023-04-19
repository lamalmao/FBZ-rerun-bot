import winston, { format } from 'winston';
import { CONSTANTS } from './properties.js';
import path from 'path';
import moment from 'moment';

const errorLogsFile = path.join(CONSTANTS.LOGS, 'errors.log');
const infoLogsFile = path.join(CONSTANTS.LOGS, 'story.log');

moment.locale('ru');
export const errorLogger = winston.createLogger({
  level: 'error',
  transports: [
    new winston.transports.File({
      filename: errorLogsFile,
      format: format.printf(
        (data) =>
          `${data.level}|${moment().format('DD-MM-YYYY hh:mm:ss')}: ${data.message}`
      )
    })
  ]
});

export const infoLogger = winston.createLogger({
  level: 'info',
  transports: [
    new winston.transports.File({
      filename: infoLogsFile,
      format: format.printf(
        (data) => `${moment().format('DD-MM-YYYY HH:mm:ss')}: ${data.message}`
      )
    })
  ]
});
