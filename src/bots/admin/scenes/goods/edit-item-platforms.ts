import { Scenes, Markup } from 'telegraf';
import { AdminBot } from '../../admin-bot.js';
import { errorLogger } from '../../../../logger.js';
import { getUserTo, jumpBack, popUp, userIs } from '../../tools.js';
import Item, { PLATFORMS } from '../../../../models/goods.js';
import { ROLES } from '../../../../models/users.js';

const EditItemPlatforms = new Scenes.BaseScene<AdminBot>('edit-item-platforms');
EditItemPlatforms.enterHandler = async function (ctx: AdminBot) {
  try {
    if (ctx.session.message && ctx.from) {
      ctx.telegram.deleteMessage(ctx.from.id, ctx.session.message).catch(() => null);
    }

    ctx.session.editItemActions = {
      action: 'cb',
      platforms: []
    };

    const buttons: Array<any> = [];
    for (const platform of Object.values(PLATFORMS)) {
      buttons.push([Markup.button.callback(platform, platform)]);
    }
    buttons.push(
      [
        Markup.button.callback('Все платформы', 'all'),
        Markup.button.callback('Сбросить', 'drop')
      ],
      [
        Markup.button.callback('Сохранить', 'save'),
        Markup.button.callback('Отмена', 'back')
      ]
    );

    const keyboard = Markup.inlineKeyboard(buttons);
    const message = await ctx.reply('Выберите платформы', {
      reply_markup: keyboard.reply_markup
    });

    ctx.session.message = message.message_id;
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
    jumpBack('edit-item')(ctx);
  }
};

EditItemPlatforms.use(getUserTo('context'), userIs([ROLES.ADMIN]));

EditItemPlatforms.action(
  'back',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    next();
  },
  jumpBack('edit-item')
);

EditItemPlatforms.action(/^(?!back|save)/, async (ctx) => {
  try {
  } catch (error: any) {
    if (!ctx.session.editItemActions || !ctx.session.editItemActions.platforms) {
      throw new Error('Ошибка во время получения данных из сессии');
    }

    if (!ctx.from || !ctx.session.message) {
      throw new Error('Не получены данные чата');
    }

    const data: string = ctx.callbackQuery['data'];
    switch (data) {
      case 'all':
        ctx.session.editItemActions.platforms = Object.values(PLATFORMS);
        break;
      case 'drop':
        ctx.session.editItemActions.platforms = [];
        break;
      default:
        ctx.session.editItemActions.platforms.push(data);
        break;
    }

    const buttons: Array<any> = [];
    let text = '__*Выбранные платформы:*__\n';
    for (const platform of ctx.session.editItemActions.platforms) {
      if (!ctx.session.editItemActions.platforms.includes(platform)) {
        buttons.push([Markup.button.callback(platform, platform)]);
      }
      text += `\n_${platform}_`;
    }

    for (const platform of Object.values(PLATFORMS)) {
      buttons.push([Markup.button.callback(platform, platform)]);
    }
    buttons.push(
      [
        Markup.button.callback('Все платформы', 'all'),
        Markup.button.callback('Сбросить', 'drop')
      ],
      [
        Markup.button.callback('Сохранить', 'save'),
        Markup.button.callback('Отмена', 'back')
      ]
    );

    await ctx.telegram.editMessageText(
      ctx.from.id,
      ctx.session.message,
      undefined,
      text,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      }
    );

    errorLogger.error(error.message);
    popUp(ctx, error.message);
    ctx.scene.reenter();
  }
});

EditItemPlatforms.action(
  'drop',
  (ctx, next) => {
    ctx.deleteMessage().catch(() => null);
    next();
  },
  (ctx) => ctx.scene.reenter()
);

EditItemPlatforms.action('save', async (ctx) => {
  try {
    if (!ctx.session.editItemActions || !ctx.session.editItemActions.platforms) {
      throw new Error('Платформы не выбраны');
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
          ['properties.platforms']: ctx.session.editItemActions.platforms
        }
      }
    );

    const text =
      result.modifiedCount > 0
        ? 'Список платформ успешно изменен'
        : 'Ошибка во время сохранения';

    popUp(ctx, text);
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, error.message);
  } finally {
    ctx.deleteMessage().catch(() => null);
    jumpBack('edit-category')(ctx);
  }
});
