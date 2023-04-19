import { Scenes, Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import Category from '../../../../models/categories.js';
import { jumpBack, popUp, replyAndDeletePrevious, userIs } from '../../tools.js';
import { ROLES } from '../../../../models/users.js';
import { callbackQuery } from 'telegraf/filters';
import { Types } from 'mongoose';

const CategoriesList = new Scenes.BaseScene<AdminBot>('categories-list');

CategoriesList.enterHandler = async function (ctx: AdminBot) {
  try {
    const categories = await Category.find(
      {},
      {
        title: 1
      }
    );

    const categoriesCount = categories.length;
    if (categoriesCount === 0) {
      popUp(
        ctx,
        '*Категорий нет*',
        {
          parse_mode: 'MarkdownV2'
        },
        10000
      );
      jumpBack()(ctx);
      return;
    }

    const buttons: Array<Array<InlineKeyboardButton>> = [];
    for (let i = 0; i < categoriesCount; i++) {
      const category = categories[i];
      buttons.push([Markup.button.callback(category.title, 'edit-category:' + category._id)]);
    }
    buttons.push([Markup.button.callback('Назад', 'back')]);

    await replyAndDeletePrevious(ctx, 'Выберите категорию из списка ниже', {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    ctx.scene.leave();
  }
};

CategoriesList.use(userIs([ROLES.ADMIN]));
CategoriesList.action('back', jumpBack());

CategoriesList.on(callbackQuery('data'), async (ctx) => {
  try {
    const data = /:([a-z0-9]+)/.exec(ctx.callbackQuery.data);
    if (!data) {
      throw new Error('Неизвестный запрос');
    }

    ctx.session.category = new Types.ObjectId(data[1]);
    ctx.scene.enter('edit-category');
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

export default CategoriesList;
