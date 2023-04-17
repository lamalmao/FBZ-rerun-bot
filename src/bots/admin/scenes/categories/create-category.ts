import { Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import Category, { CATEGORY_BLANK } from '../../../../models/categories.js';

const CreateCategory = new Scenes.BaseScene<AdminBot>('create-category');

CreateCategory.enterHandler = async function (ctx: AdminBot) {
  try {
    console.log('Creating category...');
    const categoriesCount = await Category.countDocuments();
    const category = await Category.create({
      image: CATEGORY_BLANK,
      description:
        'Описание категории \nДлина не более 3096 символов\nФорматирование MarkdownV2 https://core.telegram.org/bots/api#formatting-options',
      title: 'Категория ' + (categoriesCount + 1),
      hidden: true,
      type: 'main'
    });
    ctx.session.category = category._id;

    ctx.scene.enter('edit-category');
    console.log('Leaving creating category...');
  } catch (error: any) {
    console.log(error);
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    ctx.scene.leave();
  }
};

export default CreateCategory;
