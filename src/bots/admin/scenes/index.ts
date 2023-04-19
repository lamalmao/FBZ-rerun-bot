import { Scenes } from 'telegraf';

import CreateCategory from './categories/create-category.js';
import { AdminBot } from '../admin-bot.js';
import { jumpBack } from '../tools.js';
import { errorLogger } from '../../../logger.js';
import EditCategory from './categories/edit-category.js';
import CategoriesList from './categories/categories-list.js';

const AdminStage = new Scenes.Stage<AdminBot>([CreateCategory, EditCategory, CategoriesList]);

//debug
AdminStage.use((ctx, next) => {
  console.log(`Scene ${ctx.scene.current}:`);

  if (ctx.message && ctx.message['text']) {
    console.log(ctx.message['text']);
  }

  if (ctx.callbackQuery && ctx.callbackQuery['data']) {
    console.log(ctx.callbackQuery['data']);
  }

  next();
});

AdminStage.command('start', async (ctx) => {
  try {
    await ctx.scene.leave();
    await jumpBack()(ctx);
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

export default AdminStage;
