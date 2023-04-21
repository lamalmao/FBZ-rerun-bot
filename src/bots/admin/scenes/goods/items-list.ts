import { Scenes, Markup } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import {
  getUserTo,
  jumpBack,
  makeColumnsKeyboard,
  popUp,
  replyAndDeletePrevious,
  userIs
} from '../../tools.js';
import Item from '../../../../models/goods.js';
import { Types } from 'mongoose';
import Category from '../../../../models/categories.js';
import { ROLES } from '../../../../models/users.js';

const ItemsList = new Scenes.BaseScene<AdminBot>('items-list');
ItemsList.enterHandler = async function (ctx: AdminBot) {
  try {
    const categories = await Category.find(
      {},
      {
        title: 1
      }
    );

    const keyboard: any = [];
    for (const category of categories) {
      keyboard.push([Markup.button.callback(category.title, 'get:' + category._id)]);
    }
    keyboard.push(
      [Markup.button.callback('Товары без категорий', 'homeless')],
      [Markup.button.callback('Назад', 'exit')]
    );

    await replyAndDeletePrevious(
      ctx,
      'Выберите __категорию__, из которой хотите получить список *товаров*',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      }
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack()(ctx);
  }
};

ItemsList.command('sos', jumpBack());
ItemsList.use(getUserTo('context'), userIs([ROLES.ADMIN]));
ItemsList.action('back', (ctx) => ctx.scene.reenter());
ItemsList.action('exit', jumpBack());

ItemsList.action('homeless', async (ctx) => {
  try {
    const items = await Item.find(
      {
        category: {
          $exists: false
        }
      },
      {
        title: 1
      }
    );

    const buttons: Array<any> = [];
    for (const item of items) {
      buttons.push(Markup.button.callback(item.title, 'item:' + item._id));
    }

    const keyboard = Markup.inlineKeyboard(makeColumnsKeyboard(buttons));

    await replyAndDeletePrevious(ctx, 'Товары __без категории__', {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard.reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

ItemsList.action(/get:[a-b0-9]+/i, async (ctx) => {
  try {
    const data: string = ctx.session['data'];
    const categoryData = /([a-z0-9]+$)/i.exec(data);
    if (!categoryData) {
      throw new Error('Не найден ID категории');
    }

    const categoryId = new Types.ObjectId(categoryData[0]);
    const category = await Category.findById(categoryId, {
      title: 1
    });
    if (!category) {
      throw new Error('Категория не найдена');
    }

    const items = await Item.find(
      {
        category: categoryId
      },
      {
        title: 1
      }
    );

    const buttons: Array<any> = [];
    for (const item of items) {
      buttons.push(Markup.button.callback(item.title, 'item:' + item._id));
    }
    const keyboard = makeColumnsKeyboard(buttons);

    await replyAndDeletePrevious(ctx, `Товары из категории __${category.title}__`, {
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

ItemsList.action(/item:[a-z0-9]+/i, async (ctx) => {
  try {
    const data: string = ctx.session['data'];
    const itemData = /([a-z0-9]+$)/i.exec(data);
    if (!itemData) {
      throw new Error('Не найден ID категории');
    }

    const itemId = new Types.ObjectId(itemData[0]);
    ctx.session.item = itemId;

    ctx.scene.enter('edit-item');
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

export default ItemsList;
