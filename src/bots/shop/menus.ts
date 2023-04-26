import { Markup } from 'telegraf';

export const mainMenuButtons = {
  shop: 'shop',
  profile: 'profile',
  faq: 'faq',
  reviews: 'reviews',
  guarantees: 'guarantees',
  support: 'support'
};

export const mainMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('Магазин 🛒', mainMenuButtons.shop),
    Markup.button.callback('Профиль 👤', mainMenuButtons.profile)
  ],
  [
    Markup.button.callback('FAQ ❓', mainMenuButtons.faq),
    Markup.button.callback('Гарантии 🔰', mainMenuButtons.guarantees)
  ],
  [
    Markup.button.callback('Отзывы ⭐', mainMenuButtons.reviews),
    Markup.button.callback('Поддержка 🙋', mainMenuButtons.support)
  ]
]);
