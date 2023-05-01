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
import Item, { GAMES, ITEM_TYPES } from '../../../../models/goods.js';
import { errorLogger } from '../../../../logger.js';
import { CONSTANTS, HOST } from '../../../../properties.js';
import { ROLES } from '../../../../models/users.js';
import { Render } from '../../../../render.js';
import Category, { CATEGORY_TYPES } from '../../../../models/categories.js';
import { Types } from 'mongoose';
import { Scenario } from '../../../../scenarios.js';

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

EditItem.command(
  'sos',
  (ctx, next) => {
    ctx.session.item = undefined;
    next();
  },
  jumpBack()
);
EditItem.on('message', deleteMessage);

EditItem.action(
  'exit',
  (ctx, next) => {
    ctx.session.item = undefined;
    next();
  },
  jumpBack('items-list')
);
EditItem.action('cancel', (ctx) => {
  if (ctx.session.message && ctx.chat) {
    ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.message).catch(() => null);
    ctx.session.message = undefined;
    ctx.scene.reenter();
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
              description: value === '-' ? '\\-' : value
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
              ['cover.' + target]: parsedValue
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
        'Изменения успешно сохранены\n' + (extra ? `*${extra}*` : ''),
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
      await ctx.sendChatAction('upload_photo').catch(() => null);
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
      await ctx.sendChatAction('upload_photo');

      await Render.renderItemCovers(ctx.session.item);
      Item.findById(ctx.session.item, {
        category: 1
      })
        .then((item) => {
          if (item && item.category) {
            Render.renderCategoryCovers(item.category);
          }
        })
        .catch((error) => errorLogger.error(error.message));

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

EditItem.action('redraw', async (ctx) => {
  try {
    if (!ctx.session.item) {
      throw new Error('Не получилось загрузить данные');
    }

    await replyAndDeletePrevious(ctx, 'Перерисовываю обложки...', undefined);
    await ctx.sendChatAction('upload_photo');

    await Render.renderItemCovers(ctx.session.item);

    popUp(ctx, 'Готово!');
    ctx.scene.reenter();

    const current = ctx;
    Item.findById(ctx.session.item, {
      category: 1
    })
      .then(async (item) => {
        if (!item) {
          return;
        }
        try {
          if (!item.category) {
            return;
          }
          await Render.renderCategoryCovers(item.category);
          popUp(current, `Обложка родительской категории перерисована`);
        } catch (error: any) {
          errorLogger.error(error.message);
        }
      })
      .catch((error) => errorLogger.error(error.message));
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('show-description', async (ctx) => {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const item = await Item.findById(ctx.session.item, {
      description: 1
    });
    if (!item) {
      throw new Error('Товар не найден в базе');
    }

    await ctx.reply(item.description !== '-' ? item.description : '*Описания нет*', {
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Закрыть', 'close')]])
        .reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('close', (ctx) => {
  ctx.deleteMessage().catch(() => null);
});

EditItem.action(/(hide|show|delete)/, async (ctx) => {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }
    const data: string = ctx.callbackQuery['data'];

    ctx.session.editItemActions = {
      action: 'cb',
      target: data
    };

    await ctx.reply('Вы уверены, что хотите выполнить данное действие?', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Да', 'do'), Markup.button.callback('Нет', 'cancel')]
      ]).reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('do', async (ctx) => {
  try {
    if (
      !ctx.session.editItemActions ||
      !ctx.session.editItemActions.action ||
      !ctx.session.editItemActions.target
    ) {
      throw new Error('Ошибка во время получения задания');
    }

    if (!ctx.session.item) {
      throw new Error('Не найден ID товара');
    }

    const target = ctx.session.editCategoryActions?.target;

    if (target === 'delete') {
      const result = await Item.deleteOne({
        _id: ctx.session.item
      });

      const text =
        result.deletedCount > 0 ? 'Товар успешно удален' : 'Товар не был удален';
      popUp(ctx, text);
      jumpBack()(ctx);
      return;
    }

    let update = {};
    switch (ctx.session.editItemActions.target) {
      case 'hide':
        update = {
          $set: {
            ['properties.hidden']: true
          }
        };
        break;
      case 'show':
        update = {
          $set: {
            ['properties.hidden']: false
          }
        };
        break;
    }

    const result = await Item.updateOne(
      {
        _id: ctx.session.item
      },
      update
    );

    const text =
      result.modifiedCount > 1 ? 'Успешно' : 'Что-то пошло не так во время сохранения';
    popUp(ctx, text);

    ctx.scene.reenter();
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('move', async (ctx) => {
  try {
    const subCategories = await Category.find(
      {
        type: CATEGORY_TYPES.SUB
      },
      {
        title: 1
      }
    );

    const buttons: Array<any> = [];
    for (const category of subCategories) {
      buttons.push([
        Markup.button.callback(category.title, 'set-category:' + category._id)
      ]);
    }
    buttons.push([Markup.button.callback('Назад', 'cancel')]);

    await replyAndDeletePrevious(ctx, 'Выберите новую категорию', {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action(/set-category/i, async (ctx) => {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const data: string = ctx.callbackQuery['data'];
    const parsedData = /([a-z0-9]+)$/i.exec(data);
    if (!parsedData) {
      throw new Error('Ошибка во время получения ID категории');
    }

    const categoryId = new Types.ObjectId(parsedData[0]);
    const result = await Item.updateOne(
      {
        _id: ctx.session.item
      },
      {
        $set: {
          category: categoryId
        }
      }
    );

    const text =
      result.modifiedCount > 0
        ? 'Товар успешно перемещен'
        : 'Что-то пошло не так, не удалось сохранить изменения';

    popUp(ctx, text);
    ctx.scene.reenter();
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('game', async (ctx) => {
  try {
    const buttons: Array<any> = [];
    for (const game of Object.values(GAMES)) {
      buttons.push([Markup.button.callback(game, 'set-game:' + game)]);
    }
    buttons.push([Markup.button.callback('Отмена', 'close')]);

    const message = await ctx.reply('Выберите игру', {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup
    });
    ctx.session.message = message.message_id;
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action(/^(?!game)set-game:[a-z]+$/i, async (ctx) => {
  try {
    ctx.deleteMessage().catch(() => null);

    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const data = /([a-z]+)$/i.exec(ctx.callbackQuery['data']);
    if (!data) {
      throw new Error('Ошибка во время получения информации об игре');
    }

    const game = data[1];
    const result = await Item.updateOne(
      {
        _id: ctx.session.item
      },
      {
        $set: {
          game
        }
      }
    );

    const text =
      result.modifiedCount > 0
        ? 'Изменения успешно сохранены'
        : 'Ошибка во время сохранения';
    popUp(ctx, text);
    ctx.scene.reenter();
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('type', async (ctx) => {
  try {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Менеджером', 'set-type:' + ITEM_TYPES.MANUAL)],
      [Markup.button.callback('Ключ', 'set-type:' + ITEM_TYPES.AUTO)],
      [Markup.button.callback('Мгновенно', 'set-type:' + ITEM_TYPES.SKIP_PROCEED)],
      [Markup.button.callback('Отмена', 'close')]
    ]);

    const message = await ctx.reply('Выберите новый тип доставки товара', {
      reply_markup: keyboard.reply_markup
    });
    ctx.session.message = message.message_id;
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action(/^(?!type)set-type:[a-z]+$/i, async (ctx) => {
  try {
    ctx.deleteMessage().catch(() => null);

    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const data = /([a-z]+)$/i.exec(ctx.callbackQuery['data']);
    if (!data) {
      throw new Error('Ошибка во время получения информации о типе доставки');
    }

    const type = data[1];
    const result = await Item.updateOne(
      {
        _id: ctx.session.item
      },
      {
        $set: {
          type
        }
      }
    );

    const text =
      result.modifiedCount > 0
        ? 'Изменения успешно сохранены'
        : 'Ошибка во время сохранения';
    popUp(ctx, text);
    ctx.scene.reenter();
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('scenario', async (ctx) => {
  try {
    const buttons: Array<any> = [];
    for (const scenario of Scenario.LoadedScenarios.values()) {
      buttons.push([
        Markup.button.callback(scenario.name, 'set-scenario:' + scenario.name)
      ]);
    }
    buttons.push([Markup.button.callback('Отмена', 'close')]);

    const message = await ctx.reply('Выберите сценарий продажи', {
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup
    });
    ctx.session.message = message.message_id;
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action(/^(?!scenario)set-scenario:[a-z\-\ ]+$/i, async (ctx) => {
  try {
    ctx.deleteMessage().catch(() => null);

    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const data = /([a-z]+)$/i.exec(ctx.callbackQuery['data']);
    if (!data) {
      throw new Error('Ошибка во время получения информации о сценарии продажи');
    }

    const scenario = data[1];
    const result = await Item.updateOne(
      {
        _id: ctx.session.item
      },
      {
        $set: {
          scenario
        }
      }
    );

    const text =
      result.modifiedCount > 0
        ? 'Изменения успешно сохранены'
        : 'Ошибка во время сохранения';
    popUp(ctx, text);
    ctx.scene.reenter();
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItem.action('keys', (ctx) => ctx.scene.enter('item-keys'));
EditItem.action('platform', (ctx) => ctx.scene.enter('edit-item-platforms'));
EditItem.action('extra', (ctx) => ctx.scene.enter('edit-item-extra'));
export default EditItem;
