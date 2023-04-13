import { Markup } from 'telegraf';

export const adminKeyboard = Markup.keyboard([
  ['Категории', 'Товары'],
  ['Пользователи'],
  ['Массовое сообщение']
]).resize(true);
