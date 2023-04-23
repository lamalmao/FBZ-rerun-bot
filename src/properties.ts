import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const processDir = process.cwd();
const extras = path.join(processDir, 'extras');
const logs = path.join(processDir, 'logs');
const rawCovers = path.join(extras, 'raw-covers');
const templates = path.join(extras, 'templates');

export const CONSTANTS = {
  PROCESS_DIR: processDir,
  LOGS: logs,
  EXTRAS: extras,
  IMAGES: path.join(extras, 'images'),
  SCENARIOS: path.join(extras, 'scenarios'),
  RAW_COVERS: rawCovers,
  TEMPLATES: templates
};

export const DATA = {
  secret: 'none'
};

for (const dir of Object.values(CONSTANTS)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    console.log(dir + ' created');
  }
}

interface IBotSettings {
  token: string;
  name: string;
}

interface ISettings {
  bots: {
    admin: IBotSettings;
    shop: IBotSettings;
    debug: boolean;
  };
  db: string;
  saveTemplates: boolean;
  host: {
    address: string;
    port: number;
  };
}

const settingsFile = path.join(processDir, 'settings.json');
if (!fs.existsSync(settingsFile)) {
  console.error('"settings.json" not found!');
  process.exit(-1);
}
const secretFile = path.join(CONSTANTS.PROCESS_DIR, 'secret');
if (!fs.existsSync(secretFile)) {
  const secret = crypto.randomBytes(256).toString('hex');
  fs.writeFileSync(secretFile, secret);
  DATA.secret = secret;
  console.log('Secret generated');
} else {
  const secret = fs.readFileSync(secretFile).toString();
  DATA.secret = secret;
}

export const Settings: ISettings = JSON.parse(fs.readFileSync(settingsFile).toString());
export const HOST = 'https://' + Settings.host.address;
