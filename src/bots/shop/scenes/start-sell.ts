import { Scenes } from 'telegraf';
import { ShopBot } from '../shop-bot.js';
import { errorLogger } from '../../../logger.js';
import { popUp } from '../../admin/tools.js';
import { Types } from 'mongoose';
import Item from '../../../models/goods.js';
import { Scenario } from '../../../scenarios.js';
import Order from '../../../models/orders.js';
import { protectMarkdownString } from '../tools.js';

const startSell = new Scenes.BaseScene<ShopBot>('start-sell');
startSell.enterHandler = async function (ctx: ShopBot): Promise<void> {
  try {
    if (!ctx.callbackQuery || !ctx.from || !ctx.userInstance) {
      throw new Error('No data');
    }

    const data = /([a-z0-9]+)$/.exec(ctx.callbackQuery['data']);
    if (!data) {
      throw new Error('No data');
    }

    const user = ctx.userInstance;

    const itemId = new Types.ObjectId(data[0]);
    const item = await Item.findById(itemId, {
      scenario: 1,
      title: 1,
      price: 1,
      discount: 1
    });
    if (!item) {
      throw new Error('Item not found');
    }

    const order = await Order.create({
      client: ctx.from.id,
      item: {
        id: itemId,
        title: item.title
      },
      price: {
        amount: item.getRealPriceIn(user.region),
        region: user.region
      }
    });

    const scenario = Scenario.LoadedScenarios.get(item.scenario);
    if (!scenario) {
      throw new Error(`Scenario "${item.scenario}" not found or loaded`);
    }

    const act = scenario.acts.get(0);
    if (!act) {
      throw new Error('Empty scenario');
    }

    const keyboard = act.getTelegramKeyboardMarkup(order._id);
    const text = protectMarkdownString(act.content);

    await ctx.editMessageCaption(text, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'MarkdownV2'
    });

    ctx.scene.leave();
  } catch (e: any) {
    errorLogger.error(e.message);
    popUp(ctx, 'Произошла ошибка, попробуйте снова');
    ctx.scene.leave();
  }
};

export default startSell;
