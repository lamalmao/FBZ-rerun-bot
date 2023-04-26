import { Context, Markup, Scenes, Telegraf } from 'telegraf';
import { HOST, Settings } from '../../properties.js';
import { errorLogger } from '../../logger.js';
import User, { IUser, REGIONS, ROLES, STATUSES } from '../../models/users.js';
import { deleteMessage, getUserTo, makeColumnsKeyboard, popUp } from '../admin/tools.js';
import { appear, checkAccess, getRegion, showMenu } from './tools.js';
import Category, { CATEGORY_TYPES } from '../../models/categories.js';
import { Types } from 'mongoose';
import Item from '../../models/goods.js';

export interface SessionData {
  userInstance?: IUser;
  previousMessage?: number;
  message?: number;
}

export type BotContext = Context & Scenes.SceneContext;

export interface ShopBot extends BotContext {
  userInstance?: IUser;
  previousMessage?: number;
}

const shopBot = new Telegraf<ShopBot>(Settings.bots.shop.token);

shopBot.start(deleteMessage, getUserTo('context'), appear, checkAccess, async (ctx) => {
  try {
    const username = ctx.from.username ? ctx.from.username : ctx.from.id.toString();
    const region = ctx.from.language_code
      ? getRegion(ctx.from.language_code)
      : REGIONS.RU;
    if (!ctx.userInstance) {
      await User.create({
        telegramId: ctx.from.id,
        username,
        role: ROLES.CLIENT,
        status: STATUSES.NORMAL,
        region
      });
    }

    await showMenu(ctx);
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

shopBot.action('menu', getUserTo('context'), appear, checkAccess, showMenu);
shopBot.action('shop', getUserTo('context'), appear, checkAccess, async (ctx) => {
  try {
    if (!ctx.userInstance) {
      throw new Error('User not loaded');
    }

    const categories = await Category.find(
      {
        hidden: false,
        type: CATEGORY_TYPES.MAIN
      },
      {
        title: 1,
        image: 1
      }
    );

    const buttons: Array<any> = [];
    for (const category of categories) {
      buttons.push(
        Markup.button.callback(category.title, 'main-category:' + category._id)
      );
    }
    const keyboard = makeColumnsKeyboard(buttons, 'menu');

    await ctx.editMessageMedia({
      type: 'photo',
      media: {
        url: HOST + '/default_shop'
      }
    });
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(keyboard).reply_markup);
  } catch (error: any) {
    errorLogger.error(error.message);
  }
});

shopBot.action(
  /main-category:[a-z0-9]+$/i,
  getUserTo('context'),
  appear,
  checkAccess,
  async (ctx) => {
    try {
      if (!ctx.userInstance) {
        throw new Error('User not loaded');
      }
      const data: string = ctx.callbackQuery['data'];
      const parsedData = /([a-z0-9]+)$/i.exec(data);
      if (!parsedData) {
        popUp(ctx, 'Что-то пошло не так, попробуйте снова');
        throw new Error('ID not parsed');
      }
      const parent = new Types.ObjectId(parsedData[0]);

      const mainCategory = await Category.findById(parent, {
        title: 1,
        description: 1,
        image: 1
      });
      if (!mainCategory) {
        popUp(ctx, 'Что-то пошло не так, попробуйте снова');
        throw new Error('Category not found');
      }

      const categories = await Category.find(
        {
          hidden: false,
          type: CATEGORY_TYPES.SUB,
          parent
        },
        {
          title: 1
        }
      );

      const buttons: Array<any> = [];
      for (const category of categories) {
        buttons.push(
          Markup.button.callback(category.title, 'sub-category:' + category._id)
        );
      }
      const keyboard = makeColumnsKeyboard(buttons, 'shop');

      await ctx.editMessageMedia({
        type: 'photo',
        media: {
          url: HOST + '/' + mainCategory.image
        }
      });
      await ctx.editMessageCaption(
        `__${mainCategory.title}__` + mainCategory.description !== '-'
          ? `\n\n${mainCategory.description}`
          : '',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }
      );
    } catch (error: any) {
      errorLogger.error(error.message);
    }
  }
);

shopBot.action(
  /sub-category:[a-z0-9]+$/,
  getUserTo('context'),
  appear,
  checkAccess,
  async (ctx) => {
    try {
      if (!ctx.userInstance) {
        throw new Error('User not found');
      }

      const data: string = ctx.callbackQuery['data'];
      const parsedData = /([a-z0-9]+)$/i.exec(data);
      if (!parsedData) {
        popUp(ctx, 'Что-то пошло не так, попробуйте снова');
        throw new Error('ID not parsed');
      }

      const categoryId = new Types.ObjectId(parsedData[0]);
      const category = await Category.findById(categoryId, {
        title: 1,
        description: 1,
        parent: 1,
        ['covers.' + ctx.userInstance.region]: 1
      });
      if (!category) {
        popUp(ctx, 'Данная категория не найдена');
        throw new Error('Category not found');
      }

      const items = await Item.find(
        {
          category: categoryId,
          ['properties.hidden']: false
        },
        {
          title: 1
        }
      );
      const buttons: Array<any> = [];
      for (const item of items) {
        buttons.push(Markup.button.callback(item.title, 'item:' + item._id));
      }
      const keyboard = makeColumnsKeyboard(buttons, 'main-category:' + category.parent);

      const image = category.covers[ctx.userInstance.region];
      await ctx.editMessageMedia({
        type: 'photo',
        media: {
          url: HOST + '/' + image
        }
      });
      await ctx.editMessageCaption(
        `__${category.title}__` + category.description !== '-'
          ? `\n\n${category.description}`
          : '',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }
      );
    } catch (error: any) {
      errorLogger.error(error.message);
    }
  }
);

export default shopBot;
