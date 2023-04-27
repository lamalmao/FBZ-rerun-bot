import { Scenes } from 'telegraf';
import { ShopBot } from '../shop-bot.js';
import Refill from './refill.js';

const ShopStage = new Scenes.Stage<ShopBot>([Refill]);

export default ShopStage;
