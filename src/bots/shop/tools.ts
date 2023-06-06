import { errorLogger } from '../../logger.js';
import User, { IUser, REGIONS, STATUSES } from '../../models/users.js';
import { HOST } from '../../properties.js';
import { AdminBot } from '../admin/admin-bot.js';
import { popUp } from '../admin/tools.js';
import { mainMenuKeyboard } from './menus.js';
import { ShopBot } from './shop-bot.js';

export async function checkAccess(
  ctx: AdminBot | ShopBot,
  next: CallableFunction
): Promise<void> {
  try {
    if (!ctx.userInstance) {
      next();
      return;
    }

    if (ctx.userInstance.status === STATUSES.BLOCKED) {
      popUp(ctx, 'Ваш аккаунт заблокирован', undefined, 15000).catch(() => null);
      return;
    }

    next();
  } catch (error: any) {
    errorLogger.error(error.message);
  }
}

export async function appear(
  ctx: AdminBot | ShopBot,
  next: CallableFunction
): Promise<void> {
  try {
    if (ctx.from) {
      User.updateOne(
        {
          telegramId: ctx.from.id
        },
        {
          $set: {
            lastAction: new Date()
          }
        }
      ).catch((error) => errorLogger.error(error.message));
    }
  } catch (error: any) {
    errorLogger.error(error.message);
  } finally {
    next();
  }
}

export function getRegion(region: string): string {
  if (Object.values(REGIONS).includes(region)) {
    return region;
  } else {
    return REGIONS.RU;
  }
}

export async function editPrevious(
  ctx: ShopBot,
  text?: string,
  extra?: object,
  photo?: string
): Promise<void> {
  try {
    if (!ctx.previousMessage) {
      throw new Error('Message not found');
    }

    if (!ctx.from) {
      throw new Error('Sender not found');
    }

    if (photo) {
      await ctx.telegram.editMessageMedia(ctx.from.id, ctx.previousMessage, undefined, {
        type: 'photo',
        media: {
          url: photo
        }
      });
    }

    if (text) {
      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        ctx.previousMessage,
        undefined,
        text,
        extra
      );
    }
  } catch (error: any) {
    ctx
      .replyWithPhoto(photo ? photo : HOST + '/default_logo', {
        caption: text,
        ...extra
      })
      .catch(() => null);
    errorLogger.error(error.message);
  }
}

export async function showMenu(ctx: ShopBot): Promise<void> {
  try {
    if (ctx.previousMessage && ctx.from) {
      await ctx.telegram.editMessageMedia(ctx.from.id, ctx.previousMessage, undefined, {
        type: 'photo',
        media: {
          url: HOST + '/default_logo'
        }
      });
      await ctx.telegram.editMessageCaption(
        ctx.from.id,
        ctx.previousMessage,
        undefined,
        'Главное меню',
        {
          reply_markup: mainMenuKeyboard.reply_markup
        }
      );
    } else {
      await ctx.editMessageMedia({
        type: 'photo',
        media: {
          url: HOST + '/default_logo'
        }
      });
      await ctx.editMessageCaption('Главное меню', {
        reply_markup: mainMenuKeyboard.reply_markup
      });
    }
  } catch (error: any) {
    ctx
      .replyWithPhoto(HOST + '/default_logo', {
        caption: 'Главное меню',
        reply_markup: mainMenuKeyboard.reply_markup
      })
      .then((message) => (ctx.previousMessage = message.message_id))
      .catch(() => null);
    errorLogger.error(error.message);
  }
}

export function genNavigationRegExp(obj: object): RegExp {
  let reg = '';
  const values = Object.values(obj);
  const length = values.length;

  for (let i = 0; i < length; i++) {
    reg += values[i];
    if (i + 1 !== length) {
      reg += '|';
    }
  }

  return new RegExp(reg, 'i');
}

export function getUser(): (ctx: ShopBot, next: CallableFunction) => Promise<void> {
  async function getUser(ctx: AdminBot | ShopBot, next: CallableFunction) {
    try {
      if (!ctx || !ctx.from) {
        return;
      }
      const user: IUser | null = await User.findOne({
        telegramId: ctx.from.id
      });

      ctx.userInstance = user ? user : undefined;
      next();
    } catch (error: any) {
      errorLogger.error(error.message);
    }
  }
  return getUser;
}

export function userIs(
  roles: Array<string>
): (ctx: ShopBot, next: CallableFunction) => Promise<void> {
  async function check(ctx: AdminBot | ShopBot, next: CallableFunction) {
    const user: IUser | undefined = ctx.userInstance;
    if (!user || !roles.includes(user.role)) {
      await ctx.reply('У вас недостаточно прав');
      return;
    }
    next();
  }
  return check;
}

export function protectMarkdownString(target: string): string {
  return target
    .replaceAll(/\-/g, '\\-')
    .replaceAll(/\./g, '\\.')
    .replaceAll(/\!/g, '\\!')
    .replaceAll(/\+/g, '\\+');
}

export default function Format(target: string, ...matches): string {
  const args = matches;
  return target.replace(/{(\d+)}/g, function (match, number) {
    return typeof args[number] !== 'undefined' ? args[number] : match;
  });
}
