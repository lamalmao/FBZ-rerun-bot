import { errorLogger } from '../../logger.js';
import User, { REGIONS, STATUSES } from '../../models/users.js';
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
      throw new Error('Не получен отправитель');
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
    if (ctx.previousMessage) {
      await editPrevious(
        ctx,
        'Главное меню',
        {
          reply_markup: mainMenuKeyboard.reply_markup
        },
        HOST + '/default_logo'
      );
    } else {
      const message = await ctx.replyWithPhoto(HOST + '/default_logo', {
        reply_markup: mainMenuKeyboard.reply_markup,
        caption: 'Главное меню'
      });
      ctx.previousMessage = message.message_id;
    }
  } catch (error: any) {
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
