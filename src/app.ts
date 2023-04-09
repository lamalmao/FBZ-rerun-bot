import mongoose from 'mongoose';
import { Settings } from './properties.js';
import { errorLogger } from './logger.js';

console.log('Connecting to "' + Settings.db + '" ...');
mongoose
  .connect(Settings.db)
  .then(() => console.log('Successfully connected to db'))
  .catch((err) => {
    console.error(err);
    errorLogger.error(err.message);
    process.exit(-1);
  });
