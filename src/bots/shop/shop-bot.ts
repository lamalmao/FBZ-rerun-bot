import { Context, Markup, Scenes, Telegraf } from 'telegraf';
import { HOST, Settings } from '../../properties.js';
import { errorLogger } from '../../logger.js';
import User, { IUser, REGIONS, ROLES, Region, STATUSES } from '../../models/users.js';
import { deleteMessage, makeColumnsKeyboard, popUp } from '../admin/tools.js';
import {
  appear,
  checkAccess,
  getRegion,
  getUser,
  protectMarkdownString,
  showMenu
} from './tools.js';
import Category, { CATEGORY_TYPES } from '../../models/categories.js';
import { Types } from 'mongoose';
import Item from '../../models/goods.js';
import ShopStage from './scenes/index.js';
import LocalSession from 'telegraf-session-local';

export const CURRENCY_SIGNS = {
  ru: '₽',
  ua: '₴',
  by: 'Br',
  eu: '€'
};

export type BotContext = Context & Scenes.SceneContext;
export type BotSession = Scenes.SceneSession<Scenes.SceneSessionData>;

export interface ShopBot extends BotContext {
  userInstance?: IUser;
  previousMessage?: number;
  refill?: {
    amount: number;
    region: Region;
  };
}

const shopSession = new LocalSession({
  property: 'session',
  storage: LocalSession.storageMemory
});

const shopBot = new Telegraf<ShopBot>(Settings.bots.shop.token);
shopBot.use(shopSession.middleware());
shopBot.use(ShopStage.middleware());

//debug
shopBot.on('callback_query', (ctx, next) => {
  console.log(ctx.callbackQuery['data']);
  next();
});

shopBot.start(deleteMessage, getUser(), appear, checkAccess, async (ctx) => {
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

shopBot.action('menu', getUser(), appear, checkAccess, showMenu);
shopBot.action('shop', getUser(), appear, checkAccess, async (ctx) => {
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
    showMenu(ctx);
  }
});

shopBot.action(
  /main-category:[a-z0-9]+$/i,
  getUser(),
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
        protectMarkdownString(
          `__${mainCategory.title}__` + mainCategory.description !== '\\-'
            ? `\n\n${mainCategory.description}`
            : ''
        ),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
        }
      );
    } catch (error: any) {
      errorLogger.error(error.message);
      showMenu(ctx);
    }
  }
);

shopBot.action(/sub-category:[a-z0-9]+$/, getUser(), appear, checkAccess, async (ctx) => {
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
      protectMarkdownString(
        `__${category.title}__` + category.description !== '-'
          ? `\n\n${category.description}`
          : ''
      ),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      }
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    showMenu(ctx);
  }
});

shopBot.action(/item:[a-z0-9]+$/, getUser(), appear, checkAccess, async (ctx) => {
  try {
    if (!ctx.userInstance) {
      throw new Error('User not found');
    }

    const data: string = ctx.callbackQuery['data'];
    const parsedData = /([a-z0-9]+)$/i.exec(data);
    if (!parsedData) {
      popUp(ctx, 'ID товара не найден');
      throw new Error('ID not found');
    }

    const region = ctx.userInstance.region;
    const itemId = new Types.ObjectId(parsedData[0]);
    const item = await Item.findById(itemId, {
      title: 1,
      description: 1,
      price: 1,
      discount: 1,
      ['cover.images.' + region]: 1,
      category: 1
    });
    if (!item) {
      popUp(ctx, 'Данный товар не найден');
      throw new Error('Item not found');
    }

    const image = HOST + '/' + item.cover.images[region];
    await ctx.editMessageMedia({
      type: 'photo',
      media: {
        url: image
      }
    });
    await ctx.editMessageCaption(
      // prettier-ignore
      protectMarkdownString(`*Товар:* ${item.title}\n*Цена:* ${item.getRealPriceIn(region)} ${CURRENCY_SIGNS[region]}${item.description !== '-' ? '\n\n' + item.description : ''}`),
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Купить', 'buy:' + itemId)],
          [Markup.button.callback('Назад', 'sub-category:' + item.category)]
        ]).reply_markup,
        parse_mode: 'MarkdownV2'
      }
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    showMenu(ctx);
  }
});

shopBot.action(/buy:[a-z0-9]+/i, getUser(), appear, checkAccess, async (ctx) => {
  try {
    const user = ctx.userInstance;
    if (!user) {
      throw new Error('User not found');
    }

    const data: string = ctx.callbackQuery['data'];
    const parsedData = /([a-z0-9]+)$/i.exec(data);
    if (!parsedData) {
      throw new Error('Item ID not found');
    }

    const itemId = new Types.ObjectId(parsedData[0]);
    const item = await Item.findById(itemId, {
      title: 1,
      price: 1,
      discount: 1,
      ['cover.images.' + user.region]: 1
    });
    if (!item) {
      throw new Error('Item not found');
    }

    const realPrice = item.getRealPriceIn(user.region);
    const userBalance = user.getBalanceIn(user.region);
    if (realPrice > userBalance) {
      const dif = realPrice - userBalance;
      // prettier-ignore
      await ctx.editMessageCaption(`На вашем счету не хватает *${dif} ${CURRENCY_SIGNS[user.region]}* для покупки __"${protectMarkdownString(item.title)}"__`,
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Пополнить', `refill:${dif}#${user.region}`)],
          [Markup.button.callback('Назад', 'item:' + item._id)]
        ]).reply_markup,
        parse_mode: 'MarkdownV2'
      });
      return;
    }

    await ctx.scene.enter('start-sell');
  } catch (error: any) {
    errorLogger.error(error.message);
    showMenu(ctx);
  }
});

shopBot.action(
  /refill:\d+#(ru|ua|eu|by)/i,
  getUser(),
  appear,
  checkAccess,
  async (ctx) => {
    try {
      if (!ctx.userInstance) {
        throw new Error('Пользователь не найден');
      }

      const data: string = ctx.callbackQuery['data'];
      const parsedData = /(\d+)#(ru|ua|eu|by)$/i.exec(data);
      if (!parsedData) {
        throw new Error('value not found');
      }

      const amount = Number(parsedData[1]);
      const region = parsedData[2] as Region;

      // temporary
      if (['ua', 'eu', 'by'].includes(region)) {
        throw new Error('На данный момент пополнение из вашего региона недоступно');
      }

      ctx.refill = {
        amount,
        region
      };

      ctx.scene.enter('refill');
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
      showMenu(ctx);
    }
  }
);

shopBot.command('menu', getUser(), appear, checkAccess, showMenu);

export default shopBot;
