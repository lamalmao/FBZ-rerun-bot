import { Scenes } from 'telegraf';

import CreateCategory from './categories/create-category.js';
import { AdminBot } from '../admin-bot.js';

const AdminStage = new Scenes.Stage<AdminBot>([CreateCategory]);

export default AdminStage;
