import { Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import { jumpBack, popUp } from '../../tools.js';
import Item, { GAMES, ITEM_TYPES } from '../../../../models/goods.js';

const CreateItem = new Scenes.BaseScene<AdminBot>('create-item');
CreateItem.enterHandler = async function (ctx: AdminBot) {
  try {
    const itemsCount = await Item.count();
    const item = await Item.create({
      title: 'Товар ' + (itemsCount + 1),
      description: 'Описание товара',
      game: GAMES.FORTNITE,
      price: 100,
      type: ITEM_TYPES.MANUAL
    });

    ctx.session.item = item._id;
    ctx.scene.enter('edit-item');
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack()(ctx);
  }
};

export default CreateItem;
