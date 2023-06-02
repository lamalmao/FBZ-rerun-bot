import { Scenes } from 'telegraf';
import { ShopBot } from '../shop-bot.js';
import Refill from './refill.js';
import startSell from './start-sell.js';

const ShopStage = new Scenes.Stage<ShopBot>([Refill, startSell]);

export default ShopStage;
