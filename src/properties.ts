import fs from 'fs';
import path from 'path';

const processDir = process.cwd();
const extras = path.join(processDir, 'extras');
const logs = path.join(processDir, 'logs');

export const CONSTANTS = {
  PROCESS_DIR: processDir,
  LOGS: logs,
  EXTRAS: extras,
  IMAGES: path.join(extras, 'images'),
  SCENARIOS: path.join(extras, 'scenarios')
};

for (const dir of Object.values(CONSTANTS)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    console.log(dir + ' created');
  }
}

interface ISettings {
  bot: {
    key: string;
    name: string;
  };
  db: string;
}

const settingsFile = path.join(processDir, 'settings.json');
if (!fs.existsSync(settingsFile)) {
  console.error('"settings.json" not found!');
  process.exit(-1);
}
export const Settings: ISettings = JSON.parse(fs.readFileSync(settingsFile).toString());
