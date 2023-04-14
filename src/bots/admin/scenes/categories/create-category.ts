import { Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import { jumpBack } from '../../tools.js';
import { CATEGORY_BLANK } from '../../../../models/categories.js';

const CreateCategory = new Scenes.BaseScene<AdminBot>('create-category');

CreateCategory.enterHandler = async function (ctx: AdminBot) {
  try {
    ctx.session.newCategory = {
      hidden: false,
      title: 'Новая категория',
      type: 'main',
      description: 'Описание новой категории (максимум 3096 знаков)\nОтправьте *\\-* для пустого описания',
      image: CATEGORY_BLANK
    };
    ctx.session.categoryModification = {
      loaded: true
    };
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    ctx.scene.leave();
  }
};

CreateCategory.command('start', async (ctx) => {
  try {
    await ctx.scene.leave();
    await jumpBack(ctx);
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

export default CreateCategory;
