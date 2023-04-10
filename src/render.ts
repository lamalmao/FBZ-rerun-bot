import path from 'path';
import { errorLogger } from './logger.js';
import fs from 'fs';
import pug from 'pug';
import { Types } from 'mongoose';
import Item, { currencies } from './models/goods.js';
import { REGIONS } from './models/users.js';
import crypto from 'crypto';
import { CONSTANTS } from './properties.js';
import nodeHtmlToImage from 'node-html-to-image';
import Category from './models/categories.js';

interface ITemplate {
  styles: string;
  template: pug.compileTemplate;
}

export abstract class Render {
  private static destination: string;
  private static catalogueTemplate: ITemplate;
  private static itemTemplate: ITemplate;
  private static saveTemplates: boolean;
  private static rawTemplates: string;

  public static init(
    templatesDirectory: string,
    destinationDirectory: string,
    rawTemplatesDirectory: string,
    saveTemplates?: boolean
  ): void {
    try {
      if (!fs.existsSync(destinationDirectory)) {
        fs.mkdirSync(destinationDirectory);
      }
      this.destination = destinationDirectory;

      const itemTemplate = path.join(templatesDirectory, 'item.pug');
      const catalogueTemplate = path.join(templatesDirectory, 'catalogue.pug');
      this.rawTemplates = rawTemplatesDirectory;

      if (!fs.existsSync(itemTemplate) || !fs.existsSync(catalogueTemplate)) {
        throw new Error('Some of template files not found');
      }

      const itemTemplateStyles = fs.readFileSync(path.join(templatesDirectory, 'item.css')).toString();
      const catalogueTemplateStyles = fs.readFileSync(path.join(templatesDirectory, 'catalogue.css')).toString();

      this.itemTemplate = {
        styles: itemTemplateStyles,
        template: pug.compileFile(itemTemplate)
      };

      this.catalogueTemplate = {
        styles: catalogueTemplateStyles,
        template: pug.compileFile(catalogueTemplate)
      };

      this.saveTemplates = Boolean(saveTemplates);

      console.log('Templates loaded successfully');
    } catch (err: any) {
      console.log(err);
      errorLogger.error(err.message);
      console.log('Failed to load render mechanism');
      process.exit(-1);
    }
  }

  public static async renderItemCovers(itemId: Types.ObjectId): Promise<boolean> {
    try {
      const item = await Item.findById(itemId);
      if (!item) {
        throw new Error(`Item "${itemId.toString()}" was not found`);
      }

      const renderTasks: Array<Promise<[boolean, string]>> = [];
      // проходимся циклом по всем валютам
      for (const currency of Object.values(REGIONS)) {
        // создаем promise, который асинхронно сгенерирует html шаблон, после чего отрендерит его в изображение и сохранит
        const renderTask: Promise<[boolean, string]> = new Promise<[boolean, string]>(async (resolve, reject) => {
          try {
            const template = this.itemTemplate.template({
              item,
              currency,
              fs,
              images: CONSTANTS.IMAGES,
              styles: this.itemTemplate.styles,
              currencyText: currencies[currency]
            });

            // если при инициализации флаг saveTemplates был установлен в true, то html шаблон сохранится в файл
            if (this.saveTemplates) {
              const templateFile = `${item.title}_${currency}_${new Date().toLocaleTimeString(
                'ru-RU'
              )}.html`.replaceAll(/[\ \:]/g, '_');
              console.log();
              const templateFilePath = path.join(this.rawTemplates, templateFile);
              fs.writeFile(templateFilePath, template, (err) => {
                if (err) {
                  errorLogger.error(err.message);
                  return;
                }
              });
            }

            // рендерим изображение из шаблона и сохраняем в файл
            const imageFile = crypto.randomBytes(8).toString('hex') + '.jpg';
            await nodeHtmlToImage({
              output: path.join(this.destination, imageFile),
              html: template
            });
            console.log(imageFile);

            // сохраняем новую обложку в соответствующее поле
            await Item.updateOne(
              {
                _id: item._id
              },
              {
                $set: {
                  ['cover.images.' + currency]: imageFile
                }
              }
            );

            resolve([true, currency]);
          } catch (error) {
            // в случае ошибки возвращаем кортеж, содержащий саму ошибку и валюту на которой она случилась
            reject([error, currency]);
          }
        });

        // добавляем промис в массив промисов
        renderTasks.push(renderTask);
      }

      // ждем завершения всех промисов вне зависимости от результата
      const result = await Promise.allSettled(renderTasks);
      return result.every((p) => p.status === 'fulfilled');
    } catch (e: any) {
      errorLogger.error(e.message);
      return false;
    }
  }

  public static async renderCategoryCovers(categoryId: Types.ObjectId): Promise<boolean> {
    try {
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new Error(`Item "${categoryId.toString()}" was not found`);
      }
      if (category.type === 'main') {
        throw new Error('Category must be sub for rendering covers');
      }

      const items = await Item.find({
        category: categoryId
      });
      const renderTasks: Array<Promise<[boolean, string]>> = [];
      // проходимся циклом по всем валютам
      for (const currency of Object.values(REGIONS)) {
        // создаем promise, который асинхронно сгенерирует html шаблон, после чего отрендерит его в изображение и сохранит
        const renderTask: Promise<[boolean, string]> = new Promise<[boolean, string]>(async (resolve, reject) => {
          try {
            const template = this.catalogueTemplate.template({
              items,
              currency,
              fs,
              images: CONSTANTS.IMAGES,
              styles: this.catalogueTemplate.styles,
              currencyText: currencies[currency]
            });

            // если при инициализации флаг saveTemplates был установлен в true, то html шаблон сохранится в файл
            if (this.saveTemplates) {
              const templateFile = `${category.title}_${currency}_${new Date().toLocaleTimeString(
                'ru-RU'
              )}.html`.replaceAll(/[\ \:]/g, '_');
              const templateFilePath = path.join(this.rawTemplates, templateFile);
              fs.writeFile(templateFilePath, template, (err) => {
                if (err) {
                  errorLogger.error(err.message);
                  return;
                }
              });
            }

            // рендерим изображение из шаблона и сохраняем в файл
            const imageFile = crypto.randomBytes(8).toString('hex') + '.jpg';
            await nodeHtmlToImage({
              output: path.join(this.destination, imageFile),
              html: template
            });
            console.log(imageFile);

            // сохраняем новую обложку в соответствующее поле
            await Category.updateOne(
              {
                _id: categoryId
              },
              {
                $set: {
                  ['covers.' + currency]: imageFile
                }
              }
            );

            resolve([true, currency]);
          } catch (error) {
            // в случае ошибки возвращаем кортеж, содержащий саму ошибку и валюту на которой она случилась
            reject([error, currency]);
          }
        });

        // добавляем промис в массив промисов
        renderTasks.push(renderTask);
      }

      // ждем завершения всех промисов вне зависимости от результата
      const result = await Promise.allSettled(renderTasks);
      return result.every((p) => p.status === 'fulfilled');
    } catch (e: any) {
      errorLogger.error(e.message);
      return false;
    }
  }
}
