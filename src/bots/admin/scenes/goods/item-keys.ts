import { Markup, Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import Item from '../../../../models/goods.js';
import { ROLES } from '../../../../models/users.js';
import { message } from 'telegraf/filters';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  deleteMessage,
  getUserTo,
  jumpBack,
  popUp,
  replyAndDeletePrevious,
  userIs
} from '../../tools.js';
import Key from '../../../../models/keys.js';
import axios from 'axios';
import neatCsv from 'neat-csv';
import { CONSTANTS } from '../../../../properties.js';
import { Types } from 'mongoose';
import moment from 'moment';

interface IParsedKey {
  keys: string;
}

const ItemKeys = new Scenes.BaseScene<AdminBot>('item-keys');
ItemKeys.enterHandler = async function (ctx: AdminBot) {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const item = await Item.findById(ctx.session.item, {
      title: 1
    });
    if (!item) {
      throw new Error('Товар не найден');
    }

    const keys = await Key.find(
      {
        item: ctx.session.item
      },
      {
        sold: 1
      }
    );

    let text: string,
      available = false;

    if (keys.length > 0) {
      let free = 0,
        sold = 0;

      for (const key of keys) {
        if (!key.sold) {
          free++;
        } else {
          sold++;
        }
      }

      text = `На данный момент для товара __${item.title}__ загружено *${keys.length}* ключей\\. Из них *${free}* еще __не проданы__, а *${sold}* __проданы__\\.\n_Могут быть некоторые расхождения в числах, так как бот удерживает некоторые ключи на время оплаты, чтобы два человека не получили один и тот же ключ_`;
      available = true;
    } else {
      text = `На данный момент для товара __${item.title}__ нет загруженных ключей`;
    }

    ctx.session.editItemActions = {
      action: 'none'
    };
    await replyAndDeletePrevious(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('Активные ключи', 'free', !available),
          Markup.button.callback('Проданные ключи', 'sold', !available)
        ],
        [Markup.button.callback('Загрузить ключи', 'load')],
        [Markup.button.callback('Назад', 'exit')]
      ]).reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.enter('edit-item');
  }
};

ItemKeys.command('sos', jumpBack('edit-item'));
ItemKeys.action('exit', jumpBack('edit-item'));
ItemKeys.use(getUserTo('context'), userIs([ROLES.ADMIN]));

ItemKeys.action('cancel', (ctx) => {
  if (ctx.session.message && ctx.from) {
    ctx.deleteMessage().catch(() => null);
  }

  ctx.scene.reenter();
});

ItemKeys.action('load', async (ctx) => {
  try {
    ctx.session.editItemActions = {
      action: 'file'
    };

    const message = await ctx.reply(
      'Отправьте список ключей формате __\\.csv__\nКлючи должны находится в столбце "*keys*"',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.url(
              'Пример',
              'https://docs.google.com/spreadsheets/d/1ZP3rAY7a87Db1a-wXMRkxRdTURGVlE1XJ-uIfhsma-s/edit?usp=sharing'
            ),
            Markup.button.callback('Отмена', 'cancel')
          ]
        ]).reply_markup
      }
    );
    ctx.session.message = message.message_id;
    ctx.session.editItemActions.action = 'file';
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

ItemKeys.on(
  message('document'),
  deleteMessage,
  (ctx, next) => {
    if (ctx.session.editItemActions?.action === 'file') {
      next();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message.document.mime_type !== 'text/csv') {
        throw new Error('Неверный формат файла: ' + ctx.message.document.mime_type);
      }

      const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
      const response = await axios.get(link.href);
      if (response.status !== 200) {
        throw new Error('Ошибка во время загрузки файла');
      }

      const data: string = response.data;
      const keys = await neatCsv<IParsedKey>(data);

      const tasks: Array<Promise<any>> = [];
      for (const key of keys) {
        tasks.push(
          Key.create({
            content: key.keys,
            item: ctx.session.item
          })
        );
      }

      const result = await Promise.allSettled(tasks);
      let counter = 0;
      for (const r of result) {
        if (r.status === 'fulfilled') {
          counter++;
        }
      }

      if (ctx.session.message) {
        ctx.telegram.deleteMessage(ctx.from.id, ctx.session.message).catch(() => null);
      }
      popUp(ctx, `Успешно загружено ${counter} ключей`);
      ctx.scene.reenter();
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);

ItemKeys.action('free', async (ctx) => {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const item = await Item.findById(ctx.session.item, {
      title: 1
    });

    const keys = await Key.find(
      {
        item: ctx.session.item,
        busy: false,
        sold: false
      },
      {
        content: 1
      }
    );

    if (!keys) {
      throw new Error('Ключей нет');
    }

    let file = '';
    for (const key of keys) {
      file += key.content + '\n';
    }

    const temp = path.join(
      CONSTANTS.PROCESS_DIR,
      ctx.session.item + ':' + crypto.randomBytes(4).toString('hex') + '.txt'
    );
    fs.writeFileSync(temp, file);

    await ctx.replyWithDocument(
      {
        source: temp
      },
      {
        caption:
          'Активные ключи для товара *' + (item ? item?.title : 'неизвестно') + '*:',
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Закрыть', 'close')]
        ]).reply_markup
      }
    );

    fs.unlink(temp, (err) => {
      if (err) {
        errorLogger.error(err.message);
      }
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

ItemKeys.action('sold', async (ctx) => {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const keys = await Key.find({
      item: ctx.session.item,
      sold: true
    });
    if (!keys) {
      throw new Error('Ключей нет');
    }

    if (keys.length === 0) {
      throw new Error('Проданных ключей нет');
    }

    const pages: Array<string> = [];
    let page = 0,
      counter = 1;
    const keysList: Array<Types.ObjectId> = [];

    let text =
      'Список активированных ключей. Чтобы получить подробную информацию - введите номер ключа\n';
    for (const key of keys) {
      if (text.length >= 3900) {
        pages[page] = text;
        text = '';
        page++;
        continue;
      }

      keysList.push(key._id);
      text += '\n' + counter + '. ' + key.content;
      counter++;
    }

    if (pages.length === 0) {
      pages.push(text);
    }

    const messages: Array<number> = [];
    const length = pages.length;
    for (let i = 0; i < length; i++) {
      const message = await ctx.reply(pages[i], {
        reply_markup:
          i + 1 === length
            ? Markup.inlineKeyboard([[Markup.button.callback('Закрыть', 'collapse')]])
                .reply_markup
            : undefined
      });
      messages.push(message.message_id);
    }

    ctx.session.keys = keysList;
    ctx.session.keysMessages = messages;
    ctx.session.editItemActions = {
      action: 'text'
    };
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

ItemKeys.action('collapse', (ctx) => {
  if (ctx.session.keysMessages && ctx.from) {
    for (const message of ctx.session.keysMessages) {
      ctx.telegram.deleteMessage(ctx.from.id, message).catch(() => null);
    }
  }

  ctx.session.editItemActions = {
    action: 'none'
  };
});

ItemKeys.on(
  message('text'),
  deleteMessage,
  (ctx, next) => {
    if (ctx.session.editItemActions && ctx.session.editItemActions.action === 'text') {
      next();
    }
  },
  async (ctx) => {
    try {
      if (!ctx.session.keys) {
        ctx.scene.reenter();
        throw new Error('Не найден массив ключей');
      }

      const position = Number(ctx.message.text) - 1;
      if (Number.isNaN(position)) {
        throw new Error('Введенное значение должно быть числом');
      }
      if (position < 0) {
        throw new Error('Число должно быть больше нуля');
      }

      const keyId = ctx.session.keys[position];
      if (!keyId) {
        throw new Error('Введенное значение находится вне массива');
      }

      const key = await Key.findById(keyId);
      if (!key) {
        throw new Error('Ключ не найден в базе');
      }

      await ctx.reply(
        `Ключ __${key.content}__
        
        *Добавлен:* _${moment(key.added).format('DD.MM.YYYY [в] HH:mm')}_
        *Продан:* _${
          key.activated
            ? moment(key.activated).format('DD.MM.YYYY [в] HH:mm')
            : 'не продан'
        }_
        `.replaceAll(/\./g, '\\.'),
        {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Закрыть', 'close')]
          ]).reply_markup,
          parse_mode: 'MarkdownV2'
        }
      );
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
    }
  }
);
export default ItemKeys;
