import { FmtString } from 'telegraf/format';
import { errorLogger } from '../../logger.js';
import User, { IUser, ROLES } from '../../models/users.js';
import { AdminBot } from './admin-bot.js';
import { adminKeyboard, managerKeyboard } from './keyboard.js';
import { HOST } from '../../properties.js';
import { ICategory } from '../../models/categories.js';
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
    message = await ctx.replyWithPhoto(image, extra);
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

export function genCategoryEditingMenu(category: ICategory): [string, Markup.Markup<InlineKeyboardMarkup>] {
  const pre = 'edit-category-';
  const categoryId = category._id.toString();
  const message = `Управление категорией *${category.title}*\n\n${category.description}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Изменить название', pre + 'title:' + categoryId)],
    [Markup.button.callback('Изменить описание', pre + 'description' + categoryId)],
    [
      Markup.button.callback('Изменить изображение', pre + 'image' + categoryId, category.type !== 'main'),
      Markup.button.callback('Перерисовать обложки', 'redraw-category-covers:' + categoryId, category.type !== 'sub')
    ],
    [
      Markup.button.callback('Скрыть', 'hide:' + categoryId, category.hidden),
      Markup.button.callback('Открыть', 'show:' + categoryId, !category.hidden)
    ],
    [
      Markup.button.callback('Сделать основной', 'make-main:' + categoryId, category.type !== 'main'),
      Markup.button.callback('Сделать вложенной', 'make-sub:' + categoryId, category.type !== 'sub'),
      Markup.button.callback('Переместить', pre + 'parent:' + categoryId, category.type !== 'sub')
    ],
    [Markup.button.callback('Удалить', 'delete-category:' + categoryId)]
  ]);

  return [message, keyboard];
}
