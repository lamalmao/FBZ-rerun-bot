import { Scenes } from 'telegraf';

import CreateCategory from './categories/create-category.js';
import { AdminBot } from '../admin-bot.js';
import { jumpBack } from '../tools.js';
import { errorLogger } from '../../../logger.js';
import EditCategory from './categories/edit-category.js';

const AdminStage = new Scenes.Stage<AdminBot>([CreateCategory, EditCategory]);
AdminStage.command('start', async (ctx) => {
  try {
    await ctx.scene.leave();
    await jumpBack(ctx);
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

export default AdminStage;
