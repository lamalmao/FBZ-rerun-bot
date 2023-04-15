import { Scenes, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import adminBot, { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import Category from '../../../../models/categories.js';
import {
  EDIT_CATEGORY_PRE,
  deleteMessage,
  genCategoryEditingMenu,
  getUserTo,
  jumpBack,
  replyAndDeletePrevious,
  userIs
} from '../../tools.js';
import { Types } from 'mongoose';
import { CONSTANTS, HOST } from '../../../../properties.js';
import { ROLES } from '../../../../models/users.js';
import crypto from 'crypto';
import path from 'path';
import { writeFile } from 'fs/promises';
import fetch from 'node-fetch';

const EditCategory = new Scenes.BaseScene<AdminBot>('edit-category');

EditCategory.enterHandler = async function (ctx: AdminBot) {
  try {
    if (!ctx.session.category) {
      replyAndDeletePrevious(ctx, 'Не найден идентификатор категории', {}).catch((error) =>
        errorLogger.error(error.message)
      );
      ctx.scene.leave().catch((error) => errorLogger.error(error.message));
      return;
    }

    const category = await Category.findOne({
      _id: new Types.ObjectId(ctx.session.category)
    });
    if (!category) {
      replyAndDeletePrevious(ctx, 'Не найдена категория', {}).catch((error) => errorLogger.error(error.message));
      ctx.scene.leave().catch((error) => errorLogger.error(error.message));
      return;
    }

    ctx.session.editCategoryActions = {
      action: 'none'
    };

    const image = category.type === 'main' ? category.image : category.covers?.ru;
    const imageLink = `${HOST}/${image}`;

    const messageData = genCategoryEditingMenu(category);
    await replyAndDeletePrevious(
      ctx,
      messageData[0],
      {
        disable_web_page_preview: true,
        reply_markup: messageData[1].reply_markup,
        parse_mode: 'MarkdownV2'
      },
      imageLink
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    ctx.scene.leave();
  }
};

EditCategory.action(
  'exit',
  (ctx, next) => {
    ctx.scene.leave().catch((err) => errorLogger.error(err));
    next();
  },
  jumpBack
);
EditCategory.action('cancel', (ctx) => {
  if (ctx.chat && ctx.callbackQuery.message) {
    ctx.telegram
      .deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id)
      .catch((error) => errorLogger.error(error.message));
  }
  ctx.scene.reenter()?.catch((err) => errorLogger.error(err));
});

EditCategory.use(getUserTo('context'), userIs([ROLES.ADMIN]));
EditCategory.on('message', deleteMessage);
EditCategory.on(
  message('text'),
  (ctx, next) => {
    if (!ctx.session.editCategoryActions) {
      return;
    } else if (
      ctx.session.editCategoryActions.action === 'none' ||
      !ctx.session.editCategoryActions.target ||
      ctx.session.editCategoryActions.target === 'image'
    ) {
      return;
    }
    next();
  },
  async (ctx) => {
    try {
      const value: string = ctx.message['text'];
      if (!value) {
        throw new Error('Строка не может быть пустой');
      }

      if (value.length >= 3096) {
        throw new Error('Превышено допустимое число символов');
      }

      if (!ctx.session.category) {
        throw new Error('Не найден идентификатор категории');
      }

      if (!ctx.session.editCategoryActions || !ctx.session.editCategoryActions.target) {
        throw new Error('Не найдена цель обновления');
      }

      await Category.updateOne(
        {
          _id: ctx.session.category._id
        },
        {
          $set: {
            [ctx.session.editCategoryActions.target]: value
          }
        }
      );
      if (ctx.session.message) {
        ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.message).catch((err) => errorLogger.error(err));
      }
      await ctx.scene.reenter();
    } catch (error: any) {
      errorLogger.error(error.message);
      ctx
        .reply(error.message)
        .then((message) => {
          setTimeout(() => {
            adminBot.telegram
              .deleteMessage(message.chat.id, message.message_id)
              .catch((error) => errorLogger.error(error.message));
          }, 5000);
        })
        .catch((error) => errorLogger.error(error.message));
    }
  }
);

EditCategory.on(
  message('photo'),
  (ctx, next) => {
    if (!ctx.session.editCategoryActions || !ctx.session.editCategoryActions.target) {
      return;
    }

    if (ctx.session.editCategoryActions.action !== 'photo' || ctx.session.editCategoryActions.target !== 'image') {
      return;
    }

    next();
  },
  async (ctx) => {
    try {
      const imageFileName = crypto.randomBytes(8).toString('hex');
      const imageFilePath = path.join(CONSTANTS.IMAGES, imageFileName + '.jpg');

      const photoId = ctx.message.photo[2].file_id;
      const photoLink = await ctx.telegram.getFileLink(photoId);

      const res = await fetch(photoLink);
      const buf = await res.body;
      if (!buf) {
        throw new Error('Ошибка во время загрузки файла');
      }

      await writeFile(imageFilePath, buf);
      await Category.updateOne(
        {
          _id: ctx.session.category
        },
        {
          $set: {
            image: imageFileName
          }
        }
      );

      if (ctx.session.message) {
        ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.message).catch((error) => errorLogger.error(error.message));
      }

      await ctx.scene.reenter();
    } catch (error: any) {
      errorLogger.error(error.message);
      ctx
        .reply(error.message)
        .then((message) => {
          setTimeout(() => {
            adminBot.telegram
              .deleteMessage(message.chat.id, message.message_id)
              .catch((error) => errorLogger.error(error.message));
          }, 5000);
        })
        .catch((error) => errorLogger.error(error.message));
    }
  }
);

EditCategory.action(new RegExp(EDIT_CATEGORY_PRE + '(title|description|image)', 'i'), async (ctx) => {
  try {
    const data: string = ctx.callbackQuery['data'];
    const check = new RegExp(EDIT_CATEGORY_PRE + '(title|description|image)', 'i').exec(data);

    if (!check) {
      await ctx.answerCbQuery('Неизвестное поле');
      ctx.scene.reenter();
      return;
    }

    const target = check[1];
    ctx.session.editCategoryActions = {
      action: target === 'image' ? 'photo' : 'text',
      target
    };

    let text;
    switch (target) {
      case 'image':
        text = 'Отправьте новое изображение как фото';
        break;
      case 'title':
        text = 'Отправьте новое название категории';
        break;
      case 'description':
        text = 'Отправьте новое описание категории';
        break;
    }
    const message = await ctx.reply(text, {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Отмена', 'cancel')]]).reply_markup
    });

    ctx.session.message = message.message_id;
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.answerCbQuery('Что-то пошло не так').catch((err) => errorLogger.error(err.message));
    ctx.scene.reenter();
  }
});

export default EditCategory;
