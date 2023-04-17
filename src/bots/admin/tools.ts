import { FmtString } from 'telegraf/format';
import { errorLogger } from '../../logger.js';
import User, { IUser, ROLES } from '../../models/users.js';
import adminBot, { AdminBot } from './admin-bot.js';
import { adminKeyboard, managerKeyboard } from './keyboard.js';
import Category, { ICategory } from '../../models/categories.js';
import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';

export function getUsername(ctx: AdminBot): string {
  let username, old: string | undefined;
  if (ctx.userInstance) {
    old = ctx.userInstance.username;
  } else if (ctx.session.userInstance) {
    old = ctx.session.userInstance.username;
  }

  if (ctx.from && ctx.from.username) {
    username = ctx.from.username;
    if (old !== username) {
      User.updateOne(
        {
          telegramId: ctx.from.id
        },
        {
          $set: {
            username
          }
        }
      ).catch((error) => errorLogger.error(error.message));
    }
  } else if (old) {
    username = old;
  } else {
    username = 'unknown';
  }

  return username;
}

export function getUserTo(where: 'context' | 'session'): (ctx: AdminBot, next: CallableFunction) => Promise<void> {
  async function getUser(ctx: AdminBot, next: CallableFunction) {
    try {
      if (!ctx || !ctx.from) {
        return;
      }
      const user: IUser | null = await User.findOne({
        telegramId: ctx.from.id
      });

      if (where === 'session') {
        ctx.session.userInstance = user ? user : undefined;
      } else if (where === 'context') {
        ctx.userInstance = user ? user : undefined;
      }
      next();
    } catch (error: any) {
      errorLogger.error(error.message);
    }
  }
  return getUser;
}

export function userIs(roles: Array<string>): (ctx: AdminBot, next: CallableFunction) => Promise<void> {
  async function check(ctx: AdminBot, next: CallableFunction) {
    const user: IUser | undefined = ctx.userInstance ? ctx.userInstance : ctx.session.userInstance;
    if (!user || !roles.includes(user.role)) {
      await ctx.reply('У вас недостаточно прав');
      return;
    }
    next();
  }
  return check;
}

export async function replyAndDeletePrevious(ctx: AdminBot, text: string | FmtString, extra, image?: string) {
  let message;
  if (image) {
    extra.caption = text;
    console.log(image);
    message = await ctx.replyWithPhoto(image.trim(), extra);
  } else {
    message = await ctx.reply(text, extra);
  }

  if (ctx.session.previousMessage) {
    ctx.deleteMessage(ctx.session.previousMessage).catch((error) => errorLogger.error(error.message));
  }

  ctx.session.previousMessage = message.message_id;
  return message;
}

export async function deleteMessage(ctx: AdminBot, next: CallableFunction) {
  ctx.deleteMessage().catch((error) => errorLogger.error(error.message));
  next();
}

export async function jumpBack(ctx: AdminBot) {
  try {
    const user = ctx.userInstance ? ctx.userInstance : ctx.session.userInstance;
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    let keyboard, text;
    const username = getUsername(ctx);

    if (user.role === ROLES.ADMIN) {
      keyboard = adminKeyboard;
      text = `Меню администратора *${username}*`;
    } else {
      keyboard = managerKeyboard;
      text = `Меню менеджера *${username}*`;
    }

    await replyAndDeletePrevious(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard.reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
  }
}

export const EDIT_CATEGORY_PRE = 'edit-category-';

export async function genCategoryEditingMenu(
  category: ICategory
): Promise<[string, Markup.Markup<InlineKeyboardMarkup>]> {
  const pre = EDIT_CATEGORY_PRE;
  let message = `Управление категорией ${category.title}\n\n${category.description}`;
  if (category.type === 'sub') {
    let nestingData = 'Вложена в ';
    if (category.parent) {
      const parent = await Category.findById(category.parent);
      nestingData += `"${parent ? parent._id + ':' + parent.title : 'Неизвестная категория'}"`;
    } else {
      nestingData = 'Не вложена';
    }

    message += '\n\n' + nestingData;
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Изменить название', pre + 'title')],
    [Markup.button.callback('Изменить описание', pre + 'description')],
    [
      Markup.button.callback('Изменить изображение', pre + 'image', category.type !== 'main'),
      Markup.button.callback('Перерисовать обложки', 'redraw-category-covers', category.type !== 'sub')
    ],
    [
      Markup.button.callback('Скрыть', 'hide', category.hidden),
      Markup.button.callback('Открыть', 'show', !category.hidden)
    ],
    [
      Markup.button.callback('Сделать основной', 'make-main', category.type !== 'sub'),
      Markup.button.callback('Сделать вложенной', 'make-sub', category.type !== 'main'),
      Markup.button.callback('Переместить', 'parent', category.type !== 'sub')
    ],
    [Markup.button.callback('Удалить', 'delete-category')],
    [Markup.button.callback('Выйти', 'exit')]
  ]);

  return [message, keyboard];
}

export function cbFilter(filter: string | RegExp) {
  async function result(ctx: AdminBot, next: CallableFunction) {
    try {
      if (!ctx.callbackQuery) {
        return;
      }

      const data: string = ctx.callbackQuery['data'];
      if (typeof filter === 'string') {
        if (filter !== data) {
          return;
        }
      } else {
        if (!filter.test(data)) {
          return;
        }
      }

      next();
    } catch (error) {
      errorLogger.error(error);
      ctx.scene.reenter()?.catch((error) => errorLogger.error(error));
    }
  }

  return result;
}

export async function popUp(ctx: AdminBot, text: string, extra = {}, timeout = 5000) {
  ctx
    .reply('⚠️ ' + text, extra)
    .then((message) => {
      setInterval(() => {
        adminBot.telegram
          .deleteMessage(message.chat.id, message.message_id)
          .catch((error) => errorLogger.error(error.message));
      }, timeout);
    })
    .catch((error) => errorLogger.error(error.message));
}
