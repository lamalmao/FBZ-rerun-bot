import { Scenes } from 'telegraf';
import { ShopBot } from '../shop-bot.js';
import Refill from './refill.js';
import sellProcess from './sell-process.js';
import { showMenu } from '../tools.js';

const ShopStage = new Scenes.Stage<ShopBot>([Refill, sellProcess]);

ShopStage.start((ctx) => {
  showMenu(ctx);
  ctx.scene.leave();
});

export default ShopStage;
