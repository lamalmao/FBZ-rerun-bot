import { FmtString } from 'telegraf/format';
import { errorLogger } from '../../logger.js';
import User, { IUser, REGIONS, ROLES } from '../../models/users.js';
import { AdminBot } from './admin-bot.js';
import { adminKeyboard, managerKeyboard } from './keyboard.js';
import Category, { ICategory } from '../../models/categories.js';
import { Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';
import { IItem, ITEM_TYPES, currencies } from '../../models/goods.js';
import moment from 'moment';
import { ShopBot } from '../shop/shop-bot.js';

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

export function getUserTo(
  where: 'context' | 'session'
): (ctx: AdminBot | ShopBot, next: CallableFunction) => Promise<void> {
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

export function userIs(
  roles: Array<string>
): (ctx: AdminBot, next: CallableFunction) => Promise<void> {
  async function check(ctx: AdminBot, next: CallableFunction) {
    const user: IUser | undefined = ctx.userInstance
      ? ctx.userInstance
      : ctx.session.userInstance;
    if (!user || !roles.includes(user.role)) {
      await ctx.reply('У вас недостаточно прав');
      return;
    }
    next();
  }
  return check;
}

export async function replyAndDeletePrevious(
  ctx: AdminBot,
  text: string | FmtString,
  extra,
  image?: string
) {
  let message;
  if (image) {
    extra.caption = text;
    console.log(image);
    message = await ctx.replyWithPhoto(image.trim(), extra);
  } else {
    message = await ctx.reply(text, extra);
  }

  if (ctx.session.previousMessage) {
    ctx.deleteMessage(ctx.session.previousMessage).catch(() => null);
  }

  ctx.session.previousMessage = message.message_id;
  return message;
}

export async function deleteMessage(ctx: AdminBot, next: CallableFunction) {
  ctx.deleteMessage().catch(() => null);
  next();
}

export function jumpBack(scene?: string) {
  async function result(ctx: AdminBot) {
    try {
      const user = ctx.userInstance ? ctx.userInstance : ctx.session.userInstance;
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      let keyboard, text;
      const username = getUsername(ctx);

      if (!scene) {
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

        ctx.scene.leave();
        return;
      }

      ctx.scene.enter(scene);
    } catch (error: any) {
      errorLogger.error(error.message);
      ctx.reply('Что-то пошло не так').catch((error) => errorLogger.error(error.message));
    }
  }

  return result;
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
      nestingData += `"${
        parent ? parent._id + ':' + parent.title : 'Неизвестная категория'
      }"`;
    } else {
      nestingData = 'Не вложена';
    }

    message += '\n\n' + nestingData;
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Изменить название', pre + 'title')],
    [Markup.button.callback('Изменить описание', pre + 'description')],
    [
      Markup.button.callback(
        'Изменить изображение',
        pre + 'image',
        category.type !== 'main'
      ),
      Markup.button.callback(
        'Перерисовать обложки',
        'redraw-category-covers',
        category.type !== 'sub'
      )
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

export async function popUp(
  ctx: AdminBot | ShopBot,
  text: string,
  extra = {},
  timeout = 5000
) {
  const instance = ctx;
  ctx
    .reply('⚠️ ' + text, extra)
    .then((message) => {
      setInterval(() => {
        instance.telegram
          .deleteMessage(message.chat.id, message.message_id)
          .catch(() => null);
      }, timeout);
    })
    .catch((error) => errorLogger.error(error.message));
}

export async function genItemEditingMenu(
  item: IItem
): Promise<[string, Markup.Markup<InlineKeyboardMarkup>]> {
  let text = `\`${item._id}\`\n__*${item.title}*__\n\n*Скидка:* ${item.discount}%\n*Цена:* ${item.price} руб\n*Региональные цены с учетом скидки:*\n`;
  for (const currency of Object.values(REGIONS)) {
    text += `_${item.getRealPriceIn(currency)} ${currencies[currency]}_\n`;
  }

  let deliveryType: string;
  switch (item.type) {
    case 'manual':
      deliveryType = 'менеджером';
      break;
    case 'auto':
      deliveryType = 'ключ';
      break;
    case 'skipProceed':
      deliveryType = 'мгновенная';
      break;
    default:
      deliveryType = 'неизвестно';
      break;
  }

  let platforms = '*Список платформ:*';
  for (const platform of item.properties.platforms) {
    platforms += `\n${platform}`;
  }

  text += `\n*Игра*: ${item.game}\n*Сценарий продажи:* "${item.scenario}"\n*Тип доставки:* ${deliveryType}`;
  text += '\n' + platforms;

  const root = await Category.findById(item.category, {
    title: 1
  });
  if (root) {
    text += `\n\nВложен в категорию \`${root._id}\`:${root.title}`;
  } else {
    text += '\n\nНе вложен ни в какую из категорий';
  }

  text += `\n\n*Параметры обложки:*\n_размер шрифта описания:_ ${item.cover.descriptionFontSize}\n_размер шрифта заголовка обложки товара:_ ${item.cover.titleFontSize}\n_размер шрифта заголовка в обложке категории:_ ${item.cover.catalogueTitleFontSize}`;

  if (item.extraOptions) {
    text += `\n\n*Дополнительные опции:*\n_вопрос:_ ${item.extraOptions.title}\n*Ответы:*`;
    for (let i = 0; i < item.extraOptions.values.length; i++) {
      text += '\n' + item.extraOptions.values[i];
    }
  }

  text += `\n\n_Создан ${moment(item.created).format('DD.MM.YYYY [в] HH:mm')}_`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Изменить название', 'title')],
    [Markup.button.callback('Изменить описание под сообщением', 'description')],
    [Markup.button.callback('Изменить описание на обложке', 'coverDescription')],
    [
      Markup.button.callback('Изменить иконку', 'icon'),
      Markup.button.callback('Перерисовать обложку', 'redraw')
    ],
    [Markup.button.callback('Изменить сценарий продажи', 'scenario')],
    [Markup.button.callback('Изменить тип доставки', 'type')],
    [Markup.button.callback('Изменить игру', 'game')],
    [Markup.button.callback('Изменить платформы', 'platform')],
    [Markup.button.callback('Изменить цену', 'price')],
    [Markup.button.callback('Изменить скидку', 'discount')],
    [Markup.button.callback('Изменить дополнительные опции', 'extra')],
    [Markup.button.callback('Изменить шрифт заголовка обложки', 'titleFontSize')],
    [
      Markup.button.callback(
        'Изменить шрифт заголовка в категории',
        'catalogueTitleFontSize'
      )
    ],
    [Markup.button.callback('Ключи', 'keys', item.type !== ITEM_TYPES.AUTO)],
    [Markup.button.callback('Изменить шрифт описания в обложке', 'descriptionFontSize')],
    [
      Markup.button.callback('Скрыть', 'hide', item.properties.hidden),
      Markup.button.callback('Открыть', 'show', !item.properties.hidden)
    ],
    [Markup.button.callback('Поместить в категорию', 'move')],
    [Markup.button.callback('Удалить', 'delete')],
    [Markup.button.callback('Показать описание', 'show-description')],
    [
      Markup.button.callback('Назад', 'exit'),
      Markup.button.callback('Обновить', 'update')
    ]
  ]);

  return [text, keyboard];
}

export function makeColumnsKeyboard(
  buttons: Array<any>,
  backButton = 'back'
): Array<Array<any>> {
  const linesCount = Math.ceil(buttons.length / 2);

  const keyboard: Array<any> = [];
  for (let lineIndex = 0; lineIndex < linesCount; lineIndex++) {
    const line: Array<any> = [];
    for (let item = lineIndex * 2; item < (lineIndex + 1) * 2; item++) {
      const itemObj = buttons[item];
      if (itemObj) {
        line.push(itemObj);
      }
    }
    keyboard.push(line);
  }

  if (backButton) {
    keyboard.push([Markup.button.callback('Назад', backButton)]);
  }

  return keyboard;
}
