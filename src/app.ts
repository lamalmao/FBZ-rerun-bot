import mongoose from 'mongoose';
import { CONSTANTS, Settings } from './properties.js';
import { errorLogger } from './logger.js';
import { Scenario } from './scenarios.js';
import { Render } from './render.js';
import { ImageSecureHost } from './image-static.js';
import adminBot from './bots/admin/admin-bot.js';
import shopBot from './bots/shop/shop-bot.js';
import paymentServer from './payments-worker.js';

ImageSecureHost.listen(Settings.host.port, '0.0.0.0', () =>
  console.log('Image server launched')
);
paymentServer.listen(Settings.payment.port, '0.0.0.0', () => {
  console.log('Payment server started');
});

Render.init(
  CONSTANTS.TEMPLATES,
  CONSTANTS.IMAGES,
  CONSTANTS.RAW_COVERS,
  Settings.saveTemplates
);
console.log('Connecting to "' + Settings.db + '" ...');
mongoose
  .connect(Settings.db)
  .then(async () => console.log('Successfully connected to db'))
  .catch((err) => {
    console.error(err);
    errorLogger.error(err.message);
    process.exit(-1);
  });

Scenario.parseScenarios();
let scenarios = '';
Scenario.LoadedScenarios.forEach((scenario) => {
  scenarios += scenario.name + ' ';
});
console.log('Scenarios successfully parsed: ' + scenarios);

adminBot.launch();
console.log('Admin bot launched');
shopBot.launch();
console.log('Shop bot launched');
