import { Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import Category from '../../../../models/categories.js';
import { genCategoryEditingMenu, replyAndDeletePrevious } from '../../tools.js';
import { Types } from 'mongoose';
import { HOST } from '../../../../properties.js';

const EditCategory = new Scenes.BaseScene<AdminBot>('edit-category');

EditCategory.enterHandler = async function (ctx: AdminBot) {
  try {
    if (!ctx.session.newCategory) {
      replyAndDeletePrevious(ctx, 'Не найден идентификатор категории', {}).catch((error) =>
        errorLogger.error(error.message)
      );
      ctx.scene.leave().catch((error) => errorLogger.error(error.message));
      return;
    }

    const category = await Category.findOne({
      _id: new Types.ObjectId(ctx.session.newCategory)
    });
    if (!category) {
      replyAndDeletePrevious(ctx, 'Не найдена категория', {}).catch((error) => errorLogger.error(error.message));
      ctx.scene.leave().catch((error) => errorLogger.error(error.message));
      return;
    }

    const image = HOST + '/' + category.type === 'main' ? category.image : category.covers?.ru;
    const messageData = genCategoryEditingMenu(category);
    await replyAndDeletePrevious(
      ctx,
      messageData[0],
      {
        disable_web_page_preview: true,
        reply_markup: messageData[1].reply_markup
      },
      image
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    ctx.scene.leave();
  }
};

export default EditCategory;
