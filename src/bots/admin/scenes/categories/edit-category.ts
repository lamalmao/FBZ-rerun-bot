import { Scenes, Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';
import { message } from 'telegraf/filters';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import Category, { CATEGORY_TYPES } from '../../../../models/categories.js';
import {
  EDIT_CATEGORY_PRE,
  deleteMessage,
  genCategoryEditingMenu,
  getUserTo,
  jumpBack,
  popUp,
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
        reply_markup: messageData[1].reply_markup
      },
      imageLink
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    ctx.scene.leave();
  }
};

EditCategory.leaveHandler = async function (ctx: AdminBot, next: CallableFunction) {
  if (ctx.session.editCategoryActions) {
    ctx.session.editCategoryActions = undefined;
  }

  next();
};

EditCategory.action(
  'exit',
  (ctx, next) => {
    if (ctx.session.editCategoryActions) {
      ctx.session.editCategoryActions.action = 'none';
    }
    ctx.scene.leave().catch((err) => errorLogger.error(err));
    next();
  },
  jumpBack
);

EditCategory.action('cancel', (ctx) => {
  if (ctx.session.editCategoryActions) {
    ctx.session.editCategoryActions.action = 'none';
  }
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
      popUp(ctx, error.message, {}, 5000);
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
      popUp(ctx, error.message);
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

EditCategory.action(
  /(parent|hide|show|make-main|make-sub|delete-category)/i,
  async (ctx, next) => {
    try {
      const data: string = ctx.callbackQuery['data'];
      if (!ctx.session.editCategoryActions) {
        throw new Error('Ошибка во время выполнения изменений');
      }

      ctx.session.editCategoryActions.action = 'cb';
      if (data !== 'parent') {
        next();
        return;
      }

      const current = await Category.findById(ctx.session.category);
      if (!current) {
        throw new Error('Категория не найдена');
      }

      const parentsButtons: Array<Array<InlineKeyboardButton>> = [];
      // поиск всех основных категорий в базе, кроме той, что уже назначена как родительская данной
      const parents = await Category.find(
        {
          type: CATEGORY_TYPES.MAIN,
          _id: current.parent
            ? {
                $ne: current.parent
              }
            : undefined
        },
        {
          title: 1
        }
      );

      for (let i = 0; i < parents.length; i++) {
        const parent = parents[i];
        parentsButtons.push([Markup.button.callback(parent.title, 'set-parent:' + parent._id)]);
      }
      parentsButtons.push([Markup.button.callback('Отмена', 'cancel')]);

      const message = await ctx.reply('Выберите новую родительскую категорию', {
        reply_markup: Markup.inlineKeyboard(parentsButtons).reply_markup
      });
      ctx.session.editCategoryActions.target = 'set-parent';
      ctx.session.message = message.message_id;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  },
  async (ctx) => {
    try {
      if (!ctx.session.editCategoryActions) {
        throw new Error('Ошибка во время выполнения изменений');
      }
      const data: string = ctx.callbackQuery['data'];
      ctx.session.editCategoryActions.target = data;

      const message = await ctx.reply('Вы уверены что хотите выполнить это действие?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Да', 'do'), Markup.button.callback('Нет', 'cancel')]
        ]).reply_markup
      });
      ctx.session.message = message.message_id;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);

EditCategory.action(
  /(do|set-parent:[a-z0-9]+)/i,
  (ctx, next) => {
    if (!ctx.session.editCategoryActions || ctx.session.editCategoryActions.action !== 'cb') {
      return;
    }

    next();
  },
  (ctx, next) => {
    if (ctx.chat && ctx.session.message) {
      ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.message).catch((error) => errorLogger.error(error));
    }

    next();
  },
  async (ctx, next) => {
    try {
      if (ctx.callbackQuery['data'] !== 'delete-category') {
        next();
        return;
      }

      if (!ctx.session.category) {
        throw new Error('Не найден идентификатор категории');
      }

      const result = await Category.deleteOne({
        _id: ctx.session.category._id
      });

      if (result.deletedCount > 0) {
        ctx.answerCbQuery('Категория успешно удалена').catch((error) => errorLogger.error(error));
      }

      await jumpBack(ctx);
    } catch (error: any) {
      if (ctx.session.editCategoryActions) {
        ctx.session.editCategoryActions.action = 'none';
      }
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.session.editCategoryActions && ctx.session.editCategoryActions.target !== 'set-parent') {
        next();
        return;
      }

      if (!ctx.session.category) {
        throw new Error('Не найден идентификатор категории');
      }

      const data = /:([a-z0-9]+)/.exec(ctx.callbackQuery['data']);
      if (!data) {
        throw new Error('Ошибка во время получения id');
      }

      const newParentId = new Types.ObjectId(data[1]);

      const result = await Category.updateOne(
        {
          _id: ctx.session.category._id
        },
        {
          $set: {
            parent: newParentId
          }
        }
      );

      if (result.modifiedCount > 1) {
        ctx.answerCbQuery('Родитель успешно изменен').catch((error) => errorLogger.error(error.message));
      }

      await ctx.scene.reenter();
    } catch (error: any) {
      if (ctx.session.editCategoryActions) {
        ctx.session.editCategoryActions.action = 'none';
      }
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  },
  async (ctx) => {
    try {
      if (!ctx.session.category) {
        throw new Error('Идентификатор категории не найден');
      }

      let update: object;
      const data: string = ctx.callbackQuery['data'];
      if (data === 'delete-category') {
        await Category.deleteOne({
          _id: ctx.session.category
        });
      }

      switch (data) {
        case 'hide':
          update = {
            $set: {
              hidden: true
            }
          };
          break;
        case 'show':
          update = {
            $set: {
              hidden: false
            }
          };
          break;
        case 'make-main':
          update = {
            $set: {
              type: CATEGORY_TYPES.MAIN
            }
          };
          break;
        case 'make-sub':
          update = {
            $set: {
              type: CATEGORY_TYPES.SUB
            }
          };
          break;
        default:
          await ctx.scene.reenter();
          return;
      }

      const result = await Category.updateOne(
        {
          _id: ctx.session.category._id
        },
        update
      );

      if (result.modifiedCount > 1) {
        ctx.answerCbQuery('Изменения успешно внесены').catch((error) => errorLogger.error(error.message));
      }

      await ctx.scene.reenter();
    } catch (error: any) {
      if (ctx.session.editCategoryActions) {
        ctx.session.editCategoryActions.action = 'none';
      }
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);

export default EditCategory;
