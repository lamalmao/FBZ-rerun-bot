import mongoose from 'mongoose';
import { CONSTANTS, Settings } from './properties.js';
import { errorLogger } from './logger.js';
import { Scenario } from './scenarios.js';
import { Render } from './render.js';

console.log('Connecting to "' + Settings.db + '" ...');
mongoose
  .connect(Settings.db)
  .then(() => console.log('Successfully connected to db'))
  .catch((err) => {
    console.error(err);
    errorLogger.error(err.message);
    process.exit(-1);
  });

Scenario.parseScenarios();
let scenarios = '';
Scenario.LoadedScenarios.forEach((value, _) => {
  scenarios += value + ' ';
});
console.log('Scenarios successfully parsed: ' + scenarios);

Render.init(CONSTANTS.TEMPLATES, CONSTANTS.RAW_COVERS);
