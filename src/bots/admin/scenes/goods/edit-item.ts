import { Scenes, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import crypto from 'crypto';
import { writeFile } from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { AdminBot } from '../../admin-bot.js';
import {
  deleteMessage,
  genItemEditingMenu,
  getUserTo,
  jumpBack,
  popUp,
  replyAndDeletePrevious,
  userIs
} from '../../tools.js';
import Item from '../../../../models/goods.js';
import { errorLogger } from '../../../../logger.js';
import { CONSTANTS, HOST } from '../../../../properties.js';
import { ROLES } from '../../../../models/users.js';
import { Render } from '../../../../render.js';

const EditItem = new Scenes.BaseScene<AdminBot>('edit-item');
EditItem.enterHandler = async function (ctx: AdminBot) {
  try {
    ctx.session.message = undefined;
    ctx.session.editCategoryActions = {
      action: 'none'
    };

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
      messageData[0]
        .replaceAll(/\-/g, '\\-')
        .replaceAll(/\!/g, '\\!')
        .replaceAll(/\./g, '\\.'),
      {
        reply_markup: messageData[1].reply_markup,
        parse_mode: 'MarkdownV2'
      },
      `${HOST}/${item.cover.images.ru}`
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack()(ctx);
  }
};

EditItem.on('message', deleteMessage);

EditItem.action('exit', (ctx) => ctx.scene.leave(), jumpBack());
EditItem.action('cancel', (ctx) => {
  if (ctx.session.message && ctx.chat) {
    ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.message).catch(() => null);
    ctx.session.message = undefined;
    ctx.session.editCategoryActions = {
      action: 'none',
      target: undefined
    };
  }
});

EditItem.use(getUserTo('context'), userIs([ROLES.ADMIN]));

EditItem.on(
  message('text'),
  (ctx, next) => {
    if (
      ctx.session.editCategoryActions &&
      ctx.session.editCategoryActions.action === 'text' &&
      ctx.session.editCategoryActions.target
    ) {
      next();
    }
    return;
  },
  async (ctx) => {
    try {
      const value = ctx.message.text;
      let update = {};
      let extra: string | undefined;
      const parsedValue = Number(value);

      const target = ctx.session.editCategoryActions?.target;
      if (!target) {
        popUp(ctx, 'Действие не найдено');
        ctx.scene.reenter();
        return;
      }

      switch (target) {
        case 'title':
          if (value.length >= 150) {
            throw new Error('Слишком длинный текст');
          }

          update = {
            $set: {
              title: value
            }
          };

          extra =
            'Не забудьте перерисовать обложку товара, чтобы увидеть изменения на ней';
          break;
        case 'description':
          if (value.length >= 3096) {
            throw new Error('Слишком длинный текст');
          }

          update = {
            $set: {
              description: value
            }
          };
          break;
        case 'coverDescription':
          update = {
            $set: {
              ['cover.description']: value === '-' ? '' : value
            }
          };
          extra =
            'Не забудьте перерисовать обложку товара, чтобы увидеть изменения на ней';
          break;
        case 'price':
          if (Number.isNaN(parsedValue) || parsedValue < 1) {
            throw new Error('Введенное значение должно быть числом больше 0');
          }

          update = {
            $set: {
              price: parsedValue
            }
          };
          extra =
            'Не забудьте перерисовать обложку товара, чтобы увидеть изменения на ней';
          break;
        case 'discount':
          if (Number.isNaN(parsedValue)) {
            throw new Error('Введенное значение должно быть числом');
          } else if (parsedValue < 0) {
            throw new Error('Скидка не может быть меньше 0');
          } else if (parsedValue > 100) {
            throw new Error('Скидка не может быть больше 100');
          }

          update = {
            $set: {
              discount: parsedValue
            }
          };
          extra =
            'Не забудьте перерисовать обложку товара, чтобы увидеть изменения на ней';
          break;
        case 'titleFontSize':
        case 'catalogueTitleFontSize':
        case 'descriptionFontSize':
          if (Number.isNaN(parsedValue) || parsedValue <= 0) {
            throw new Error('Введенное значение должно быть числом больше 0');
          }

          update = {
            $set: {
              [target]: parsedValue
            }
          };

          extra =
            'Не забудьте перерисовать обложку товара, чтобы увидеть изменения на ней';
          break;
        default:
          break;
      }

      const result = await Item.updateOne(
        {
          _id: ctx.session.item
        },
        update
      );

      if (result.modifiedCount < 1) {
        popUp(ctx, 'Что-то пошло не так\nЗначение не было сохранено');
        ctx.scene.reenter();
        return;
      }

      popUp(
        ctx,
        'Изменения успешно сохранены' + (extra ? `*${extra}*` : ''),
        {
          parse_mode: 'MarkdownV2'
        },
        10000
      );
      if (ctx.session.message) {
        ctx.telegram.deleteMessage(ctx.from.id, ctx.session.message).catch(() => null);
      }

      ctx.scene.reenter();
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message, undefined, 3000);
    }
  }
);

EditItem.on(
  message('photo'),
  (ctx, next) => {
    if (
      ctx.session.editCategoryActions &&
      ctx.session.editCategoryActions.action === 'photo' &&
      ctx.session.editCategoryActions.target
    ) {
      next();
    }
    return;
  },
  async (ctx) => {
    try {
      if (!ctx.session.item) {
        popUp(ctx, 'Не найден ID категории');
        ctx.scene.reenter();
        return;
      }

      if (ctx.session.message) {
        ctx.telegram.deleteMessage(ctx.from.id, ctx.session.message).catch(() => null);
      }

      await replyAndDeletePrevious(ctx, 'Качаю изображение...', {});
      ctx.sendChatAction('typing').catch(() => null);
      const imageFileName = crypto.randomBytes(8).toString('hex');
      const imageFilePath = path.join(CONSTANTS.IMAGES, imageFileName + '.jpg');

      const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const photoLink = await ctx.telegram.getFileLink(photoId);

      const res = await fetch(photoLink);
      const buf = await res.body;
      if (!buf) {
        throw new Error('Ошибка во время загрузки файла');
      }

      await writeFile(imageFilePath, buf);
      const result = await Item.updateOne(
        {
          _id: ctx.session.item
        },
        {
          $set: {
            icon: imageFileName
          }
        }
      );

      if (result.modifiedCount < 1) {
        popUp(ctx, 'Ошибка во время сохранения информации в базу данных');
        ctx.scene.reenter();
        return;
      }

      await replyAndDeletePrevious(ctx, 'Перерисовываю обложки...', {});
      ctx.sendChatAction('typing').catch(() => null);

      await Render.renderItemCovers(ctx.session.item);

      popUp(ctx, 'Готово!', undefined, 1500);
      ctx.scene.reenter();
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message, undefined, 3000);
      ctx.scene.reenter();
    }
  }
);

EditItem.action('update', (ctx) => ctx.scene.reenter());
EditItem.action(
  /^(?!show-description)(title|description|coverDescription|icon|price|discount|titleFontSize|catalogueTitleFontSize|descriptionFontSize)/,
  (ctx, next) => {
    if (ctx.session.message && ctx.chat) {
      ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.message).catch(() => null);
    }
    next();
  },
  async (ctx) => {
    try {
      let text = 'Введите новое значение';
      const data: string = ctx.callbackQuery['data'];
      ctx.session.editCategoryActions = {
        action: 'text',
        target: data
      };

      if (data === 'icon') {
        ctx.session.editCategoryActions.action = 'photo';
        text = 'Отправьте новую обложку фотографией (не файлом)';
      }

      const message = await ctx.reply(text, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Отмена', 'cancel')]
        ]).reply_markup
      });
      ctx.session.message = message.message_id;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
      ctx.scene.reenter();
    }
  }
);

export default EditItem;
