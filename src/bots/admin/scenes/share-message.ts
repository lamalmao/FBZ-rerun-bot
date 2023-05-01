import { Scenes, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { AdminBot } from '../admin-bot.js';
import { errorLogger } from '../../../logger.js';
import { deleteMessage, getUserTo, jumpBack, popUp, userIs } from '../tools.js';
import User, { ROLES } from '../../../models/users.js';
import { HOST } from '../../../properties.js';
import shopBot from '../../shop/shop-bot.js';

const ShareMessage = new Scenes.BaseScene<AdminBot>('share-message');
ShareMessage.enterHandler = async function (ctx: AdminBot) {
  try {
    const message = await ctx.reply(
      'Отправьте сообщение с необходимым текстом и форматированием\\. Можно добавить __одно__ фото\\.',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Отмена', 'exit')]])
          .reply_markup
      }
    );
    ctx.session.message = message.message_id;
    ctx.session.shareData = {
      action: 'message'
    };
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack()(ctx);
  }
};

ShareMessage.leaveHandler = function (ctx, next) {
  if (ctx.session.message && ctx.from) {
    ctx.telegram.deleteMessage(ctx.from.id, ctx.session.message).catch(() => null);
  }

  if (ctx.session.shareData && ctx.from) {
    const data = ctx.session.shareData;
    if (data.menu) {
      ctx.telegram.deleteMessage(ctx.from.id, data.menu).catch(() => null);
    }
    if (data.extraMenu) {
      ctx.telegram.deleteMessage(ctx.from.id, data.extraMenu).catch(() => null);
    }
  }
  next();
};

ShareMessage.action('exit', jumpBack());

ShareMessage.on(
  message('text'),
  deleteMessage,
  getUserTo('context'),
  userIs([ROLES.ADMIN]),
  async (ctx, next) => {
    try {
      if (ctx.session.shareData?.action !== 'message') {
        next();
        return;
      }

      ctx.session.shareData = {
        action: 'none',
        type: 'text',
        entities: ctx.message.entities,
        text: ctx.message.text
      };

      const preview = await ctx.reply(ctx.message.text, {
        entities: ctx.message.entities,
        disable_web_page_preview: true
      });
      const menu = await ctx.reply('Редактирование сообщения на рассылку', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Добавить кнопки под сообщение', 'edit-buttons')],
          [Markup.button.callback('Изменить текст сообщения', 'edit-text')],
          [Markup.button.callback('Добавить изображение', 'edit-photo')],
          [Markup.button.callback('Отмена', 'exit')]
        ]).reply_markup
      });

      ctx.session.shareData.menu = menu.message_id;
      ctx.session.shareData.preview = preview.message_id;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
      ctx.scene.leave();
    }
  },
  async (ctx, next) => {
    try {
      if (ctx.session.shareData?.action !== 'buttons') {
        next();
        return;
      }

      const text = ctx.message.text;
      const keyboard: Array<Array<any>> = [];
      for (const line of text.split('\n')) {
        const parsedLine: Array<any> = [];
        for (let item of line.split(',')) {
          item = item.trim();
          const values: [string, string] = item.split('!') as [string, string];
          const buttonText = values[0].trimEnd();
          const buttonData = values[1].trimStart();
          if (buttonData.startsWith('http')) {
            parsedLine.push(Markup.button.url(buttonText, buttonData));
          } else {
            parsedLine.push(Markup.button.callback(buttonText, buttonData));
          }
        }

        keyboard.push(parsedLine);
      }

      ctx.session.shareData.keyboard = keyboard;
      await ctx.telegram.editMessageReplyMarkup(
        ctx.from.id,
        ctx.session.shareData.preview,
        undefined,
        Markup.inlineKeyboard(keyboard).reply_markup
      );
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  },
  async (ctx) => {
    try {
      if (ctx.session.shareData?.action !== 'text') {
        return;
      }

      const text = ctx.message.text;
      const entities = ctx.message.entities;
      const reply_markup = ctx.session.shareData.keyboard
        ? Markup.inlineKeyboard(ctx.session.shareData.keyboard).reply_markup
        : undefined;

      if (ctx.session.shareData.type === 'text') {
        await ctx.telegram.editMessageText(
          ctx.from.id,
          ctx.session.shareData.preview,
          undefined,
          text,
          {
            entities,
            reply_markup,
            disable_web_page_preview: true
          }
        );
      } else {
        await ctx.telegram.editMessageCaption(
          ctx.from.id,
          ctx.session.shareData.preview,
          undefined,
          text,
          {
            caption_entities: entities,
            reply_markup
          }
        );
      }

      ctx.session.shareData.text = text;
      ctx.session.shareData.entities = entities;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);

ShareMessage.action('done', getUserTo('context'), userIs([ROLES.ADMIN]), (ctx) => {
  try {
    if (ctx.session.shareData) {
      ctx.session.shareData.action = 'none';
      if (ctx.session.shareData.extraMenu && ctx.from) {
        ctx.telegram
          .deleteMessage(ctx.from.id, ctx.session.shareData.extraMenu)
          .catch(() => null);
      }
    }
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
  }
});

ShareMessage.on(
  message('photo'),
  getUserTo('context'),
  userIs([ROLES.ADMIN]),
  deleteMessage,
  async (ctx, next) => {
    try {
      if (ctx.session.shareData?.action !== 'message') {
        next();
        return;
      }

      const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      ctx.session.shareData = {
        action: 'none',
        type: 'photo',
        entities: ctx.message.caption_entities,
        text: ctx.message.caption,
        photo
      };

      const preview = await ctx.replyWithPhoto(photo, {
        caption_entities: ctx.message.caption_entities,
        caption: ctx.message.caption
      });
      const menu = await ctx.reply('Редактирование сообщения на рассылку', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Добавить кнопки под сообщение', 'edit-buttons')],
          [Markup.button.callback('Изменить текст сообщения', 'edit-text')],
          [Markup.button.callback('Добавить изображение', 'edit-photo')],
          [
            Markup.button.callback('Разослать сообщение', 'share'),
            Markup.button.callback('Отмена', 'exit')
          ]
        ]).reply_markup
      });

      ctx.session.shareData.menu = menu.message_id;
      ctx.session.shareData.preview = preview.message_id;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.session.shareData?.action !== 'photo') {
        return;
      }

      const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      if (ctx.session.shareData.type === 'photo') {
        await ctx.telegram.editMessageMedia(
          ctx.from.id,
          ctx.session.shareData.preview,
          undefined,
          {
            type: 'photo',
            media: photo
          }
        );
      } else if (ctx.session.shareData.type === 'text') {
        if (ctx.session.shareData.preview) {
          ctx.telegram
            .deleteMessage(ctx.from.id, ctx.session.shareData.preview)
            .catch(() => null);
        }
        const newPreview = await ctx.replyWithPhoto(photo, {
          caption: ctx.session.shareData.text,
          caption_entities: ctx.session.shareData.entities,
          reply_markup: ctx.session.shareData.keyboard
            ? Markup.inlineKeyboard(ctx.session.shareData.keyboard).reply_markup
            : undefined
        });

        ctx.session.shareData.preview = newPreview.message_id;
      }

      ctx.session.shareData.photo = photo;
      ctx.session.shareData.action = 'none';
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
      ctx.scene.leave();
    }
  }
);

ShareMessage.action(
  'edit-buttons',
  getUserTo('context'),
  userIs([ROLES.ADMIN]),
  async (ctx) => {
    try {
      if (!ctx.session.shareData) {
        throw new Error('Не найдена информация о сообщении');
      }

      ctx.session.shareData.action = 'buttons';
      const extraMenu = await ctx.reply(
        '__Отправьте список кнопок в формате:__\nТекст Кнопки 1\\!data1, Текст Кнопки 2\\!data2\nТекст Кнопки 3\\!data3\n\n_Вместо __data__ необходимо подставить один из вариантов ниже:_\nmenu \\- меню\nfaq \\- вопросы\nshop \\- магазин\nprofile \\- профиль\nguarantees \\- гарантии\nreviews \\- отзывы\nsupport \\- поддержка\nmain\\-category:id \\- основная категория\nsub\\-category:id \\- вложенная категория\nitem:id \\- товар\nhttps://example\\.org \\- ссылка, ВАЖНО: ссылка обязательно должна начинаться с *http* или *https*\\!\n\n*Вместо id необходимо подставить id товара или категории на которую хотите ссылаться\nДанные кнопки НЕ будут работать внутри админ\\-бота*',
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Готово', 'done')]
          ]).reply_markup,
          parse_mode: 'MarkdownV2'
        }
      );
      ctx.session.shareData.extraMenu = extraMenu.message_id;
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);

ShareMessage.action(
  'edit-text',
  getUserTo('context'),
  userIs([ROLES.ADMIN]),
  async (ctx) => {
    if (!ctx.session.shareData) {
      return;
    }

    const extraMenu = await ctx.reply('Отправьте новый текст', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Готово', 'done')]])
        .reply_markup
    });

    ctx.session.shareData.action = 'text';
    ctx.session.shareData.extraMenu = extraMenu.message_id;
    try {
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);

ShareMessage.action('share', getUserTo('context'), userIs([ROLES.ADMIN]), async (ctx) => {
  try {
    const count = await User.countDocuments();
    await ctx.reply(
      `Вы уверены что хотите разослать это сообщение __${count}__ пользователям(ю)`,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Да', 'yes'), Markup.button.callback('Нет', 'no')]
        ]).reply_markup
      }
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
  }
});

ShareMessage.action('no', deleteMessage);
ShareMessage.action('yes', getUserTo('context'), userIs([ROLES.ADMIN]), async (ctx) => {
  try {
    if (
      !ctx.session.shareData ||
      !ctx.session.shareData.text ||
      !ctx.session.shareData.type
    ) {
      return;
    }

    const users = await User.find(
      {},
      {
        telegramId: 1
      }
    );

    const text = ctx.session.shareData.text;
    const entities = ctx.session.shareData.entities;
    const photo = ctx.session.shareData.photo
      ? ctx.session.shareData.photo
      : {
          url: HOST + '/default_logo'
        };
    const reply_markup = ctx.session.shareData.keyboard
      ? Markup.inlineKeyboard(ctx.session.shareData.keyboard).reply_markup
      : undefined;
    const send =
      ctx.session.shareData.type === 'text'
        ? (user: number) =>
            shopBot.telegram.sendMessage(user, text, {
              entities,
              reply_markup,
              disable_web_page_preview: true
            })
        : (user: number) =>
            shopBot.telegram.sendPhoto(user, photo, {
              caption: text,
              caption_entities: entities,
              reply_markup
            });

    const tasks: Array<Promise<void>> = [];
    for (const user of users) {
      tasks.push(
        new Promise<void>(async (resolve, reject) => {
          try {
            await send(user.telegramId);
            resolve();
          } catch (error: any) {
            console.log(error.message);
            reject(error);
          }
        })
      );
    }

    await Promise.allSettled(tasks);
    await ctx.reply('Сообщение успешно разослано');
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
  } finally {
    ctx.scene.leave();
  }
});

export default ShareMessage;
