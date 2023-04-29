import { Context, Scenes, Telegraf } from 'telegraf';
import { CONSTANTS, Settings } from '../../properties.js';
import LocalSession from 'telegraf-session-local';
import path from 'path';
import { errorLogger } from '../../logger.js';
import User, { IUser, ROLES } from '../../models/users.js';
import crypto from 'crypto';
import fs from 'fs';
import {
  Back,
  adminKeyboard,
  adminKeyboardButtons,
  categoriesMainMenu,
  categoriesMainMenuButtons,
  goodsKeyboard,
  goodsKeyboardButtons
} from './keyboard.js';
import {
  getUserTo,
  jumpBack,
  popUp,
  replyAndDeletePrevious,
  userIs,
  deleteMessage
} from './tools.js';
import AdminStage from './scenes/index.js';
import { Types } from 'mongoose';
import moment from 'moment';
import { spawn } from 'child_process';

export interface SessionData {
  userInstance?: IUser;
  previousMessage?: number;
  item?: Types.ObjectId;
  category?: Types.ObjectId;
  keys?: Array<Types.ObjectId>;
  keysMessages?: Array<number>;
  editCategoryActions?: {
    action: 'none' | 'text' | 'photo' | 'cb' | string;
    target?: string;
  };
  editItemActions?: {
    action: 'none' | 'text' | 'photo' | 'cb' | string;
    target?: string;
    platforms?: Array<string>;
    extra?: {
      title: string;
      values: Array<string>;
    };
  };

  message?: number;
}

export type BotContext = Context & Scenes.SceneContext;
export type BotSession = SessionData & Scenes.SceneSession<Scenes.SceneSessionData>;

export interface AdminBot extends BotContext {
  session: BotSession;
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

adminBot.start(deleteMessage, async (ctx) => {
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

adminBot.use(getUserTo('session'));
adminBot.use(AdminStage.middleware());

adminBot.hears(Back, deleteMessage, userIs([ROLES.ADMIN, ROLES.MANAGER]), jumpBack());

adminBot.command(
  'secret',
  deleteMessage,
  getUserTo('context'),
  userIs([ROLES.ADMIN]),
  (ctx) => {
    ctx
      .replyWithDocument(
        {
          source: path.join(CONSTANTS.PROCESS_DIR, 'secret'),
          filename: 'key.txt'
        },
        {
          caption: 'Ключ шифрования'
        }
      )
      .catch(() => null);
  }
);

adminBot.command('admin', deleteMessage, userIs([ROLES.ADMIN]), async (ctx) => {
  try {
    const username = ctx.session.userInstance
      ? ctx.session.userInstance.username
      : ctx.from.username;

    await replyAndDeletePrevious(ctx, `Панель администратора *${username}*`, {
      parse_mode: 'MarkdownV2',
      reply_markup: adminKeyboard.reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

adminBot.command('logs', deleteMessage, userIs([ROLES.ADMIN]), async (ctx) => {
  try {
    await ctx.replyWithDocument(
      {
        source: path.join(CONSTANTS.LOGS, 'errors.log')
      },
      {
        caption: 'Логи бота'
      }
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
  }
});

adminBot.hears(
  adminKeyboardButtons.categories,
  deleteMessage,
  userIs([ROLES.ADMIN]),
  async (ctx) => {
    try {
      await replyAndDeletePrevious(ctx, 'Меню управления *категориями*', {
        parse_mode: 'MarkdownV2',
        reply_markup: categoriesMainMenu.reply_markup
      });
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, 'Что-то пошло не так');
    }
  }
);

adminBot.hears(
  categoriesMainMenuButtons.create,
  deleteMessage,
  userIs([ROLES.ADMIN]),
  (ctx) => ctx.scene.enter('create-category')
);

adminBot.hears(
  categoriesMainMenuButtons.list,
  deleteMessage,
  userIs([ROLES.ADMIN]),
  (ctx) => ctx.scene.enter('categories-list')
);

adminBot.hears(
  adminKeyboardButtons.goods,
  deleteMessage,
  userIs([ROLES.ADMIN]),
  async (ctx) => {
    try {
      await replyAndDeletePrevious(ctx, 'Меню управления *товарами*', {
        parse_mode: 'MarkdownV2',
        reply_markup: goodsKeyboard.reply_markup
      });
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, 'Что-то пошло не так');
    }
  }
);

adminBot.hears(goodsKeyboardButtons.create, deleteMessage, userIs([ROLES.ADMIN]), (ctx) =>
  ctx.scene.enter('create-item')
);

adminBot.hears(goodsKeyboardButtons.list, deleteMessage, userIs([ROLES.ADMIN]), (ctx) =>
  ctx.scene.enter('items-list')
);

adminBot.command('load', getUserTo('context'), userIs([ROLES.ADMIN]), async (ctx) => {
  try {
    await ctx.sendChatAction('record_video');
    const password = crypto.randomBytes(16).toString('hex');
    const zipFileName =
      'shot_' + moment(new Date()).format('DD_MM_YYYY_HH_mm_ss') + '.zip';

    const zip = spawn('zip', ['-P', password, zipFileName, '-r', 'extras']);
    const result = new Promise(function (resolve, reject) {
      zip.addListener('exit', resolve);
      zip.addListener('error', reject);
    });

    await result;
    const pathToArchive = path.join(CONSTANTS.PROCESS_DIR, zipFileName);
    await ctx.sendChatAction('upload_document');
    await ctx.sendDocument({
      source: pathToArchive
    });
    popUp(
      ctx,
      `Пароль к архиву: \`${password}\`\n_Сообщение с паролем удалится через 1 минуту_`,
      {
        parse_mode: 'MarkdownV2'
      },
      60000
    );
    fs.unlinkSync(pathToArchive);
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
  }
});

export default adminBot;
