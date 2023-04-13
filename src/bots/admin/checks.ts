import { errorLogger } from '../../logger.js';
import User, { IUser } from '../../models/users.js';
import { AdminBot } from './admin-bot.js';

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
