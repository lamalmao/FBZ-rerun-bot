import { Markup, Scenes } from 'telegraf';
import { message } from 'telegraf/filters';
import { CURRENCY_SIGNS, ShopBot } from '../shop-bot.js';
import { errorLogger } from '../../../logger.js';
import { popUp } from '../../admin/tools.js';
import { Types } from 'mongoose';
import Item from '../../../models/goods.js';
import {
  SCENARIO_ACTS_TYPES,
  SCENARIO_BUTTONS_TYPES,
  SCENARIO_DATA_TYPES,
  Scenario
} from '../../../scenarios.js';
import Order, { ORDER_STATUSES } from '../../../models/orders.js';
import { getUser, protectMarkdownString, showMenu } from '../tools.js';
import User from '../../../models/users.js';

const moveReg = new RegExp(`${SCENARIO_BUTTONS_TYPES.MOVE}#(\\d+)`, 'i');
const cancelReg = new RegExp(`${SCENARIO_BUTTONS_TYPES.CANCEL}#([a-z0-9]+)`, 'i');
const sellReg = new RegExp(`${SCENARIO_BUTTONS_TYPES.SELL}#([a-z0-9]+)`, 'i');

const sellProcess = new Scenes.BaseScene<ShopBot>('sell-process');
sellProcess.enterHandler = async function (ctx: ShopBot): Promise<void> {
  try {
    if (!ctx.callbackQuery || !ctx.from || !ctx.userInstance) {
      throw new Error('No data');
    }

    const data = /([a-z0-9]+)$/.exec(ctx.callbackQuery['data']);
    if (!data) {
      throw new Error('No data');
    }

    const user = ctx.userInstance;

    const itemId = new Types.ObjectId(data[0]);
    const item = await Item.findById(itemId, {
      scenario: 1,
      title: 1,
      price: 1,
      discount: 1
    });
    if (!item) {
      throw new Error('Item not found');
    }

    const order = await Order.create({
      client: ctx.from.id,
      item: {
        id: itemId,
        title: item.title
      },
      price: {
        amount: item.getRealPriceIn(user.region),
        region: user.region
      }
    });

    const scenario = Scenario.LoadedScenarios.get(item.scenario);
    if (!scenario) {
      throw new Error(`Scenario "${item.scenario}" not found or loaded`);
    }

    const act = scenario.acts.get(0);
    if (!act) {
      throw new Error('Empty scenario');
    }

    const keyboard = act.getTelegramKeyboardMarkup(order._id);
    const text = protectMarkdownString(act.content);

    await ctx.editMessageCaption(text, {
      reply_markup: keyboard.reply_markup,
      parse_mode: 'MarkdownV2'
    });

    ctx.sellProcess = {
      scenario,
      item,
      order,
      step: 0,
      previous: 0,
      data: new Map<string, string>()
    };
  } catch (e: any) {
    errorLogger.error(e.message);
    popUp(ctx, 'Произошла ошибка, попробуйте снова.\nЕсли вы застряли, напишите /start');
    ctx.scene.leave();
  }
};

sellProcess.action(moveReg, async (ctx) => {
  try {
    if (!ctx.from) {
      throw new Error('No user data');
    }

    console.log(ctx.sellProcess);

    if (!ctx.sellProcess) {
      throw new Error('No sell data ' + ctx.from.id);
    }

    const rawData = moveReg.exec(ctx.callbackQuery['data']);
    if (!rawData) {
      throw new Error('Data not parsed');
    }
    const actId = Number.parseInt(rawData[1]);

    const act = ctx.sellProcess.scenario.acts.get(actId);
    if (!act) {
      throw new Error(`Act ${actId} in ${ctx.sellProcess.scenario.name} not found`);
    }

    ctx.sellProcess.dataRequest = undefined;

    await ctx.editMessageCaption(protectMarkdownString(act.content), {
      reply_markup: act.getTelegramKeyboardMarkup(ctx.sellProcess.item._id).reply_markup
    });

    ctx.sellProcess.previous = ctx.sellProcess.step;
    ctx.sellProcess.step = actId;

    switch (act.type) {
      case SCENARIO_ACTS_TYPES.INFO:
        return;
      case SCENARIO_ACTS_TYPES.DATA:
        if (!act.dataType) {
          throw new Error(
            `Data type not found in act ${act.id} of scenario ${ctx.sellProcess.scenario.name}`
          );
        }

        ctx.sellProcess.dataRequest = {
          target: act.dataType,
          validation: Boolean(act.validate)
        };
        return;
    }
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, 'Произошла ошибка, попробуйте снова.\nЕсли вы застряли, напишите /start');
  }
});

sellProcess.action(cancelReg, (ctx) => {
  showMenu(ctx);
  ctx.scene.leave();
});

sellProcess.action(sellReg, getUser(), async (ctx) => {
  try {
    if (!ctx.sellProcess || !ctx.from || !ctx.userInstance) {
      throw new Error('No data');
    }

    const price = ctx.sellProcess.item.getRealPrice();
    if (price > ctx.userInstance.balance) {
      const difference = Math.ceil(
        ctx.sellProcess.item.getPriceIn(ctx.userInstance.region) -
          ctx.userInstance.getBalanceIn(ctx.userInstance.region)
      );

      //prettier-ignore
      await ctx.editMessageCaption(protectMarkdownString(
        `На вашем счету не хватает ${difference} ${CURRENCY_SIGNS[ctx.userInstance.region]}`
      ), {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Пополнить счёт', `refill#${difference}#${ctx.userInstance.region}`)]
        ]).reply_markup
      });
    }

    ctx.sellProcess.order.paid = true;
    ctx.sellProcess.order.status = ORDER_STATUSES.UNTAKEN;

    const tasks = [
      User.updateOne(
        {
          telegramId: ctx.from.id
        },
        {
          balance: {
            $inc: -ctx.sellProcess.item.getRealPrice()
          }
        }
      ),
      Order.updateOne(
        {
          orderId: ctx.sellProcess.order.orderId
        },
        {
          $set: {
            paid: true,
            status: ORDER_STATUSES.UNTAKEN
          }
        }
      )
    ];

    await Promise.all(tasks);

    await ctx.editMessageCaption(
      protectMarkdownString(`Ваш заказ \`${ctx.sellProcess.order.orderId}\` оформлен`)
    );
  } catch (error: any) {
    errorLogger.error(error.message);
    popUp(ctx, 'Произошла ошибка, попробуйте снова.\nЕсли вы застряли, напишите /start');
  }
});

sellProcess.on(
  message('text'),
  (ctx, next) => {
    if (!ctx.sellProcess || !ctx.sellProcess.dataRequest) {
      return;
    }

    next();
  },
  async (ctx) => {
    try {
      ctx.deleteMessage().catch(() => null);

      if (!ctx.sellProcess || !ctx.sellProcess.dataRequest) {
        throw new Error('Data not found');
      }

      let value = ctx.message.text;
      if (ctx.sellProcess.dataRequest.validation) {
        switch (ctx.sellProcess.dataRequest.target) {
          case SCENARIO_DATA_TYPES.EMAIL:
            if (
              !/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/.test(
                value
              )
            ) {
              popUp(ctx, 'Введенное значение не является электронной почтой');
              return;
            }
            break;
          case SCENARIO_DATA_TYPES.NUMBER:
            const rawNumber = /^[\+]?[\d\-\(\)\ ]{7,}$/is.exec(value);
            if (!rawNumber) {
              popUp(ctx, 'Введенное значение не является номером телефона');
              return;
            }

            value = rawNumber[0].replace(/[\+\-\(\)\ ]/g, '');
            break;
          case SCENARIO_DATA_TYPES.PASSWORD:
            if (value.length <= 6) {
              popUp(ctx, 'Введенное значение не является паролем');
              return;
            }
            break;
        }
      }

      ctx.sellProcess.data.set(ctx.sellProcess.dataRequest.target, value);
      popUp(ctx, 'Сохранено', undefined, 1000);
    } catch (error: any) {
      errorLogger.error(error.message);
      popUp(
        ctx,
        'Произошла ошибка, попробуйте снова.\nЕсли вы застряли, напишите /start'
      );
    }
  }
);

export default sellProcess;
