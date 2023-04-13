import { Context, Scenes, Telegraf } from 'telegraf';
import { CONSTANTS, Settings } from '../../properties.js';
import LocalSession from 'telegraf-session-local';
import path from 'path';
import { errorLogger } from '../../logger.js';
import User, { IUser, ROLES } from '../../models/users.js';
import { adminKeyboard } from './keyboard.js';
import { getUserTo, userIs } from './checks.js';

export interface SessionData extends Scenes.SceneSessionData {
  // userInstance?: Document<unknown, object, IUser>;
  userInstance?: IUser;
}

export interface AdminBot extends Context {
  session: SessionData;
  userInstance?: IUser;
}

const adminBot = new Telegraf<AdminBot>(Settings.bots.admin.token);

const adminSession = new LocalSession({
  database: path.join(CONSTANTS.PROCESS_DIR, 'admin-session.json'),
  property: 'session',
  storage: LocalSession.storageFileAsync,
  format: {
    serialize: (obj) => JSON.stringify(obj, null, 2),
    deserialize: (str) => JSON.parse(str)
  }
});

adminBot.use(adminSession.middleware());

adminBot.start(async (ctx) => {
  try {
    const user = await User.findOne(
      {
        telegramId: ctx.from.id
      },
      {
        role: 1
      }
    );

    if (!user || (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER)) {
      return;
    }

    const time = new Date().getHours();
    let dayPart = '';

    if (time >= 0 && time <= 6) {
      dayPart = 'ой ночи';
    } else if (time > 6 && time <= 12) {
      dayPart = 'ое утро';
    } else if (time > 12 && time <= 18) {
      dayPart = 'ый день';
    } else {
      dayPart = 'ый вечер';
    }
    await ctx.reply(
      `Добр${dayPart}, *${ctx.from.username}*\\!\n_/admin_ \\- для меню администратора\n_/manager_ \\- для меню менеджера`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: adminKeyboard.reply_markup
      }
    );
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

adminBot.command('admin', getUserTo('context'), userIs([ROLES.ADMIN]), async (ctx) => {
  try {
    const username = ctx.session.userInstance ? ctx.session.userInstance.username : ctx.from.username;

    await ctx.reply(`Панель администратора *${username}*`, {
      parse_mode: 'MarkdownV2',
      reply_markup: adminKeyboard.reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

export default adminBot;
