import { Types as MongooseTypes } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types';
import { Markup } from 'telegraf';
import { CONSTANTS } from './properties.js';
import { errorLogger, infoLogger } from './logger.js';

const SCENARIO_BUTTONS_TYPES = {
  MOVE: 'move', // Переместиться на указанный шаг
  CANCEL: 'cancel', // Отменить покупку
  SELL: 'sell' // Купить
};

const SCENARIO_ACTS_TYPES = {
  INFO: 'info', // Информационный шаг
  DATA: 'data', // Шаг для запроса информации на ввод (логины пароли и тп)
  SHOWUP: 'showup' // Шаг с демонстрацией введенных пользователем данных ему же для проверки
};

const SCENARIO_DATA_TYPES = {
  LOGIN: 'login', // Любой вид логина, т.е. почта или пароль
  EMAIL: 'email', // Почта в качестве логина
  NUMBER: 'number', // Номер в качестве логина
  PASSWORD: 'password', // Пароль, в т.ч. можно будет указать вход по коду
  ANOTHER: 'another', // Любая другая информация
  ADDITIONAL: 'additional' // Варианты выбора, которые задаются еще при создании товара
};

class ScenarioButton {
  public content: string;
  public type: string;
  private pointer?: number;

  public constructor(content: string, type: string, pointer?: number) {
    this.content = content;

    if (!Object.values(SCENARIO_BUTTONS_TYPES).includes(type)) {
      throw new Error('Несуществующий тип кнопки');
    }
    this.type = type;

    if (type === SCENARIO_BUTTONS_TYPES.MOVE && typeof pointer !== 'number') {
      throw new Error('Для кнопок обязателен указатель на акт\n\ncontent: ' + content);
    }
    this.pointer = pointer;
  }

  public markupData(itemId: MongooseTypes.ObjectId): InlineKeyboardButton {
    let data: string;

    if (this.type != SCENARIO_BUTTONS_TYPES.CANCEL) {
      data = this.type + '#' + this.pointer;
    } else if (
      this.type === SCENARIO_BUTTONS_TYPES.CANCEL ||
      this.type === SCENARIO_BUTTONS_TYPES.SELL
    ) {
      data = this.type + '#' + itemId.toString();
    } else {
      data = this.type;
    }

    return {
      text: this.content,
      callback_data: data
    };
  }
}

class ScenarioAct {
  public buttons: Array<Array<ScenarioButton>>;
  public content: string;
  public type: string;
  public dataType?: string;
  public validate?: boolean;
  public next?: number;
  public readonly id: number;

  public constructor(
    id: number,
    content: string,
    type: string,
    buttons: Array<Array<ScenarioButton>>,
    validate?: boolean,
    next?: number,
    dataType?: string
  ) {
    this.buttons = buttons;
    this.content = content;

    if (Number.isNaN(id)) {
      throw new Error('id должен быть числом');
    }
    this.id = id;

    if (!Object.values(SCENARIO_ACTS_TYPES).includes(type)) {
      throw new Error('Такого типа акта не существует');
    }

    if (type === SCENARIO_ACTS_TYPES.DATA) {
      if (typeof validate === 'undefined') {
        throw new Error(
          'Для шагов запроса информации необходимо указать необходимость проверки информации'
        );
      }

      if (!next) {
        throw new Error(
          'Для шагов запроса информации обязательно указывать следующий шаг в теле акта'
        );
      }

      if (!dataType || !Object.values(SCENARIO_DATA_TYPES).includes(dataType)) {
        throw new Error(`Тип данных не указан или указан неверно`);
      }

      this.dataType = dataType;
      this.validate = validate;
      this.next = next;
    }

    this.type = type;
  }

  public getTelegramKeyboardMarkup(
    itemId: MongooseTypes.ObjectId
  ): Markup.Markup<InlineKeyboardMarkup> {
    const keyboardArray = new Array<Array<InlineKeyboardButton>>();

    this.buttons.forEach((line) => {
      const newLine = new Array<InlineKeyboardButton>();
      line.forEach((button) => {
        newLine.push(button.markupData(itemId));
      });

      keyboardArray.push(newLine);
    });

    return Markup.inlineKeyboard(keyboardArray);
  }
}

export class Scenario {
  public readonly name: string;
  public acts: Map<number, ScenarioAct>;
  public static LoadedScenarios: Map<string, Scenario> = new Map();

  public constructor(name: string, acts: Array<ScenarioAct>) {
    this.name = name;
    this.acts = new Map<number, ScenarioAct>();
    acts.forEach((act) => {
      this.acts.set(act.id, act);
    });
  }

  public static readFromFile(filename: string): Scenario {
    const file = JSON.parse(
      fs.readFileSync(path.join(CONSTANTS.SCENARIOS, filename)).toString()
    );

    const name: string = file['name'];
    const acts: Array<any> = file['acts'];
    const parsedActs: Array<ScenarioAct> = [];

    acts.forEach((element) => {
      const buttons: Array<any> = element['buttons'];
      const parsedButtons: Array<Array<ScenarioButton>> = [];
      buttons.forEach((line) => {
        const parsedLine: Array<ScenarioButton> = [];
        line.forEach((button: { [x: string]: any }) => {
          parsedLine.push(
            new ScenarioButton(button['content'], button['type'], button['pointer'])
          );
        });
        parsedButtons.push(parsedLine);
      });

      parsedActs.push(
        new ScenarioAct(
          element['id'],
          element['content'],
          element['type'],
          parsedButtons,
          element['validate'],
          element['next'],
          element['dataType']
        )
      );
    });

    return new Scenario(name, parsedActs);
  }

  public static parseScenarios(): void {
    const scenariosPath = CONSTANTS.SCENARIOS;

    const scenarioFiles: Array<string> = fs.readdirSync(scenariosPath);
    if (scenarioFiles.length === 0) {
      infoLogger.info('Сценарии продаж не найдены');
      return;
    }

    scenarioFiles.forEach((scenarioFile) => {
      try {
        const newScenario = Scenario.readFromFile(scenarioFile);
        Scenario.LoadedScenarios.set(newScenario.name, newScenario);
        infoLogger.info(`Сценарий ${newScenario.name} успешно загружен`);
      } catch (e) {
        errorLogger.error(
          `Ошибка во время загрузки сценария из файла: ${scenarioFile}\n\n${e}`
        );
      }
    });
  }
}
