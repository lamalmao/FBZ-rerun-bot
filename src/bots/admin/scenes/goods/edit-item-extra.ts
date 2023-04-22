import { Markup, Scenes } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import {
  deleteMessage,
  getUserTo,
  jumpBack,
  popUp,
  replyAndDeletePrevious,
  userIs
} from '../../tools.js';
import Item from '../../../../models/goods.js';
import { ROLES } from '../../../../models/users.js';
import { message } from 'telegraf/filters';

const EditItemExtra = new Scenes.BaseScene<AdminBot>('edit-item-extra');
EditItemExtra.enterHandler = async function (ctx: AdminBot) {
  try {
    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const item = await Item.findById(ctx.session.item, {
      extraOptions: 1,
      title: 1
    });
    if (!item) {
      throw new Error('Товар не найден');
    }

    let text: string;
    const extra = item.extraOptions;
    if (extra) {
      text = `__Текущие дополнительные опции__\n\n*Вопрос:* ${extra.title}\n*Варианты ответа:*`;
      for (const answer of extra.values) {
        text += `\n_${answer}_`;
      }
    } else {
      text = 'На данный момент дополнительных опций нет';
    }

    ctx.session.editItemActions = {
      action: 'none',
      extra: extra
        ? extra
        : {
            title: 'Вопрос',
            values: []
          }
    };
    await replyAndDeletePrevious(ctx, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback('Изменить вопрос', 'question'),
          Markup.button.callback('Изменить опции', 'answers')
        ],
        [Markup.button.callback('Сохранить', 'save')],
        [Markup.button.callback('Назад', 'exit')]
      ]).reply_markup
    });
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack('edit-item')(ctx);
  }
};

EditItemExtra.action('exit', (ctx) => jumpBack('edit-item')(ctx));
EditItemExtra.action('close', (ctx) => {
  ctx.deleteMessage().catch(() => null);
});

EditItemExtra.command('sos', jumpBack());
EditItemExtra.use(getUserTo('context'), userIs([ROLES.ADMIN]));
EditItemExtra.action('question', async (ctx) => {
  try {
    if (!ctx.session.editItemActions) {
      throw new Error('Ошибка во время получения данных');
    }

    const message = await ctx.reply('Введите новый вопрос', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Отмена', 'close')]])
        .reply_markup
    });
    ctx.session.message = message.message_id;
    ctx.session.editItemActions.action = 'text';
    ctx.session.editItemActions.target = 'title';
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack('edit-item')(ctx);
  }
});

EditItemExtra.action('answers', async (ctx) => {
  try {
    if (!ctx.session.editItemActions) {
      throw new Error('Ошибка во время получения данных');
    }

    if (!ctx.session.editItemActions) {
      throw new Error('Ошибка во время получения данных');
    }

    const message = await ctx.reply(
      '*Введите новые варианты ответа*\n_Каждый новый вариант на новой строке_',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('Отмена', 'close')]])
          .reply_markup
      }
    );
    ctx.session.message = message.message_id;
    ctx.session.editItemActions.action = 'text';
    ctx.session.editItemActions.target = 'values';
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack('edit-item')(ctx);
  }
});

EditItemExtra.action('save', async (ctx) => {
  try {
    if (!ctx.session.editItemActions || !ctx.session.editItemActions.extra) {
      throw new Error('Нечего сохранять');
    }

    if (!ctx.session.item) {
      throw new Error('ID товара не найден');
    }

    const result = await Item.updateOne(
      {
        _id: ctx.session.item
      },
      {
        $set: {
          extraOptions: ctx.session.editItemActions.extra
        }
      }
    );

    const text =
      result.modifiedCount > 0
        ? 'Изменения сохранены'
        : 'Что-то пошло не так во время сохранения изменений';
    popUp(ctx, text);

    jumpBack('edit-item')(ctx);
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack('edit-item')(ctx);
  }
});

EditItemExtra.on(
  message('text'),
  deleteMessage,
  (ctx, next) => {
    if (ctx.session.message) {
      ctx.telegram.deleteMessage(ctx.from.id, ctx.session.message).catch(() => null);
    }

    if (ctx.session.editItemActions && ctx.session.editItemActions.action === 'text') {
      next();
    }
  },
  async (ctx) => {
    try {
      if (
        !ctx.session.editItemActions ||
        !ctx.session.editItemActions.target ||
        !ctx.session.editItemActions.extra
      ) {
        throw new Error('Цель неизвестна');
      } else if (!ctx.session.item) {
        throw new Error('Не найден ID товара');
      } else if (!ctx.session.previousMessage) {
        throw new Error('Потеряно сообщение');
      }

      const target = ctx.session.editItemActions.target;
      const value = target === 'title' ? ctx.message.text : ctx.message.text.split('\n');

      ctx.session.editItemActions.extra[target] = value;

      ctx.session.editItemActions.target = undefined;
      ctx.session.editItemActions.action = 'none';

      let text = `*${ctx.session.editItemActions.extra.title}*\n`;
      for (const answer of ctx.session.editItemActions.extra.values) {
        text += `\n_${answer}_`;
      }

      await ctx.telegram.editMessageText(
        ctx.from.id,
        ctx.session.previousMessage,
        undefined,
        text.replaceAll(/\-/g, '\\-').replaceAll(/\!/g, '\\!').replaceAll(/\./g, '\\.'),
        {
          parse_mode: 'MarkdownV2',
          reply_markup: Markup.inlineKeyboard([
            [
              Markup.button.callback('Изменить вопрос', 'question'),
              Markup.button.callback('Изменить опции', 'answers')
            ],
            [Markup.button.callback('Сохранить', 'save')],
            [Markup.button.callback('Назад', 'exit')]
          ]).reply_markup
        }
      );
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(ctx, error.message);
      jumpBack('edit-item')(ctx);
    }
  }
);
export default EditItemExtra;
