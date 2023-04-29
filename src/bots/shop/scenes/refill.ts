import { Scenes, Markup } from 'telegraf';
import { CURRENCY_SIGNS, ShopBot } from '../shop-bot.js';
import { errorLogger } from '../../../logger.js';
import { popUp } from '../../admin/tools.js';
import { REGIONS } from '../../../models/users.js';
import { HOST } from '../../../properties.js';
import Payment from '../../../models/payments.js';

const PLATFORMS = {
  ru: 'anypay',
  ua: 'card'
};

const Refill = new Scenes.BaseScene<ShopBot>('refill');
Refill.enterHandler = async function (ctx: ShopBot): Promise<void> {
  try {
    if (!ctx.refill || !ctx.from) {
      throw new Error('No refill data');
    }

    if ([REGIONS.EU, REGIONS.BY].includes(ctx.refill.region)) {
      throw new Error('Unsupported region');
    }

    const refill = await Payment.create({
      user: ctx.from.id,
      price: ctx.refill,
      platform: PLATFORMS[ctx.refill.region]
    });

    const refillData = ctx.refill;
    // prettier-ignore
    let text = `*Ваш счет на __${refillData.amount} ${CURRENCY_SIGNS[refillData.region]}__ создан*\n_Пожалуйста, не удаляйте данное сообщение, после подтверждения оплаты оно изменится_`;

    if (refillData.region === 'ua') {
      text +=
        '\n\nПереведите указанную сумму на карту `0000-0000-0000-0000`, после чего нажмите на кнопку ниже';
    }

    const refillMessage = await ctx.replyWithPhoto(HOST + '/default_refill', {
      caption: text,
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.url(
            'Оплатить',
            refill.genAnyPayLink(),
            refill.platform !== 'anypay'
          )
        ],
        [
          Markup.button.callback(
            'Оплатил',
            'check-card-payment:' + refill.paymentId,
            refill.platform !== 'card'
          )
        ]
      ]).reply_markup
    });

    refill.telegramMessage = refillMessage.message_id;
    refill.isNew = false;
    refill.save().catch((error) => errorLogger.error(error.message));
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, 'Что-то пошло не так во время выставления счета, попробуйте снова', 20000);
  } finally {
    ctx.refill = undefined;
    ctx.scene.leave();
  }
};

export default Refill;
