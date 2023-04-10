import path from 'path';
import { errorLogger } from './logger.js';
import fs from 'fs';
import pug from 'pug';
import { Types } from 'mongoose';
import Item from './models/goods.js';
import { REGIONS } from './models/users.js';
import crypto from 'crypto';
import { CONSTANTS } from './properties.js';
import nodeHtmlToImage from 'node-html-to-image';

interface ITemplate {
  styles: string;
  template: pug.compileTemplate;
}

interface TemplateRenderResult {
  image: string;
  currency: string;
}

export abstract class Render {
  private static destination: string;
  private static catalogueTemplate: ITemplate;
  private static itemTemplate: ITemplate;
  private static saveTemplates: boolean;

  public static init(templatesDirectory: string, destinationDirectory: string, saveTemplates?: boolean): void {
    try {
      if (!fs.existsSync(destinationDirectory)) {
        fs.mkdirSync(destinationDirectory);
      }
      this.destination = destinationDirectory;

      const itemTemplate = path.join(templatesDirectory, 'item.pug');
      const catalogueTemplate = path.join(templatesDirectory, 'catalogue.pug');

      if (!fs.existsSync(itemTemplate) || !fs.existsSync(catalogueTemplate)) {
        throw new Error('Some of template files not found');
      }

      this.itemTemplate.styles = fs.readFileSync(path.join(templatesDirectory, 'item.css')).toString();
      this.catalogueTemplate.styles = fs.readFileSync(path.join(templatesDirectory, 'catalogue.css')).toString();

      this.itemTemplate.template = pug.compileFile(itemTemplate);
      this.catalogueTemplate.template = pug.compileFile(catalogueTemplate);

      this.saveTemplates = Boolean(saveTemplates);

      console.log('Templates loaded successfully');
    } catch (err: any) {
      errorLogger.error(err.message);
      console.log('Failed to load render mechanism');
      process.exit(-1);
    }
  }

  private static async renderItemCovers(itemId: Types.ObjectId): Promise<Array<string>> {
    try {
      const item = await Item.findById(itemId);
      if (!item) {
        throw new Error(`Item "${itemId.toString()}" was not found`);
      }

      const renderTasks: Array<Promise<TemplateRenderResult>> = [];
      // проходимся циклом по всем валютам
      for (const currency of Object.values(REGIONS)) {
        // создаем promise, который асинхронно сгенерирует html шаблон, после чего отрендерит его в изображение и сохранит
        const renderTask: Promise<TemplateRenderResult> = new Promise<TemplateRenderResult>(async (resolve, reject) => {
          try {
            const template = this.itemTemplate.template({
              item,
              currency
            });

            // если при инициализации флаг saveTemplates был установлен в true, то html шаблон сохранится в файл
            if (this.saveTemplates) {
              const templateFile = crypto.randomBytes(8).toString('hex') + '.html';
              const templateFilePath = path.join(CONSTANTS.RAW_COVERS, templateFile);
              fs.writeFile(templateFilePath, template, (err) => {
                if (err) {
                  errorLogger.error(err.message);
                  return;
                }
                console.log(`${item.title}`);
              });
            }

            // рендерим изображение из шаблона и сохраняем в файл
            const imageFile = crypto.randomBytes(8).toString() + 'jpg';
            await nodeHtmlToImage({
              output: path.join(CONSTANTS.IMAGES, imageFile),
              html: template
            });

            // передаем название файла и валюту как возврат из промиса
            resolve({
              image: imageFile,
              currency
            });
          } catch (error) {
            // в случае ошибки возвращаем объект, содержащий саму ошибку и валюту на которой она случилась
            reject({
              currency,
              error
            });
          }
        });

        // добавляем промис в массив промисов
        renderTasks.push(renderTask);
      }

      // ждем завершения всех промисов вне зависимости от результата
      const result = await Promise.allSettled(renderTasks);
      for (const renderResult of result) {
        if (renderResult.status === 'fulfilled') {
          const data = renderResult.value;
        }
      }
    } catch (e: any) {
      errorLogger.error(e.message);
    }
  }
}
