import { Markup } from 'telegraf';

export const Back = 'Назад';

export const adminKeyboardButtons = {
  categories: 'Категории',
  goods: 'Товары',
  users: 'Пользователи',
  spread: 'Массовая рассылка'
};

export const adminKeyboard = Markup.keyboard([
  [adminKeyboardButtons.categories, adminKeyboardButtons.goods],
  [adminKeyboardButtons.users],
  [adminKeyboardButtons.spread]
]).resize(true);

export const categoriesMainMenuButtons = {
  create: 'Создать категорию',
  list: 'Список категорий'
};

export const categoriesMainMenu = Markup.keyboard([
  [categoriesMainMenuButtons.create],
  [categoriesMainMenuButtons.list],
  [Back]
]).resize(true);

export const managerKeyboardButtons = {
  takeOrder: 'Взять заказ',
  retakeOrder: 'Перехватить заказ'
};

export const managerKeyboard = Markup.keyboard([
  [managerKeyboardButtons.takeOrder, managerKeyboardButtons.retakeOrder],
  [Back]
]).resize(true);

export const goodsKeyboardButtons = {
  create: 'Добавить товар',
  list: 'Список товаров'
};

export const goodsKeyboard = Markup.keyboard([
  [goodsKeyboardButtons.create, goodsKeyboardButtons.list],
  [Back]
]);
