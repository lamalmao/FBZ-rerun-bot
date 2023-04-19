import { Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import {
  genItemEditingMenu,
  jumpBack,
  popUp,
  replyAndDeletePrevious
} from '../../tools.js';
import Item from '../../../../models/goods.js';
import { errorLogger } from '../../../../logger.js';

const EditItem = new Scenes.BaseScene<AdminBot>('edit-item');
EditItem.enterHandler = async function (ctx: AdminBot) {
  try {
    if (!ctx.session.item) {
      throw new Error('Не найден id товара');
    }

    const item = await Item.findById(ctx.session.item);
    if (!item) {
      throw new Error('Товар не найден');
    }

    const messageData = await genItemEditingMenu(item);
    await replyAndDeletePrevious(
      ctx,
      messageData[0],
      {
        reply_markup: messageData[1].reply_markup,
        parse_mode: 'MarkdownV2'
      },
      item.cover.images.ru
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack()(ctx);
  }
};

export default EditItem;
