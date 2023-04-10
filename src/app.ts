import mongoose, { Types } from 'mongoose';
import { CONSTANTS, Settings } from './properties.js';
import { errorLogger } from './logger.js';
import { Scenario } from './scenarios.js';
import { Render } from './render.js';

Render.init(CONSTANTS.TEMPLATES, CONSTANTS.IMAGES, CONSTANTS.RAW_COVERS, Settings.saveTemplates);
console.log('Connecting to "' + Settings.db + '" ...');
mongoose
  .connect(Settings.db)
  .then(async () => {
    console.log('Successfully connected to db');
    const result = await Render.renderItemCovers(new Types.ObjectId('64343201d9d28c1e7219ef99'));
    console.log(result);
  })
  .catch((err) => {
    console.error(err);
    errorLogger.error(err.message);
    process.exit(-1);
  });

Scenario.parseScenarios();
let scenarios = '';
Scenario.LoadedScenarios.forEach((value) => {
  scenarios += value + ' ';
});
console.log('Scenarios successfully parsed: ' + scenarios);
