import { Scenes } from 'telegraf';

import CreateCategory from './categories/create-category.js';
import { AdminBot } from '../admin-bot.js';
import EditCategory from './categories/edit-category.js';
import CategoriesList from './categories/categories-list.js';
import CreateItem from './goods/create-item.js';
import EditItem from './goods/edit-item.js';
import EditItemPlatforms from './goods/edit-item-platforms.js';
import ItemsList from './goods/items-list.js';
import EditItemExtra from './goods/edit-item-extra.js';
import ItemKeys from './goods/item-keys.js';
import ShareMessage from './share-message.js';

const AdminStage = new Scenes.Stage<AdminBot>([
  CreateCategory,
  EditCategory,
  CategoriesList,
  CreateItem,
  EditItem,
  EditItemPlatforms,
  ItemsList,
  EditItemExtra,
  ItemKeys,
  ShareMessage
]);

//debug
// AdminStage.use((ctx, next) => {
//   console.log(`Scene ${ctx.scene.current?.id}:`);

//   if (ctx.message && ctx.message['text']) {
//     console.log(ctx.message['text']);
//   }

//   if (ctx.callbackQuery && ctx.callbackQuery['data']) {
//     console.log(ctx.callbackQuery['data']);
//   }

//   next();
// });

AdminStage.on('callback_query', (ctx, next) => {
  ctx.answerCbQuery().catch(() => null);
  next();
});

export default AdminStage;
