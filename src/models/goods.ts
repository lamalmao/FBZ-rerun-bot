import { Schema, SchemaTypes, Types, model } from 'mongoose';
import { Region } from './users.js';

export const DEFAULT_ITEM_COVER = 'item_cover.jpg';

export const courses = {
  ru: 1,
  ua: 2.22,
  by: 32.35,
  eu: 89.17
};

export const currencies = {
  ru: 'руб',
  ua: 'грн',
  by: 'руб',
  eu: 'евро'
};

export const PLATFORMS = {
  PS: 'PS',
  PC: 'PC',
  ANDROID: 'android',
  XBOX: 'xbox',
  NINTENDO: 'nintendo',
  NONE: 'none'
};

export const GAMES = {
  FORTNITE: 'fortnite',
  BRAWLSTARS: 'brawlstars',
  GENSHIN: 'genshin',
  ALL: 'all'
};

export type ItemType = 'manual' | 'auto' | 'skipProceed';
export const ITEM_TYPES = {
  MANUAL: 'manual',
  AUTO: 'auto',
  SKIP_PROCEED: 'skipProceed'
};

export interface IItem {
  title: string;
  itemType: string;
  category: Types.ObjectId;
  game: string;
  description?: string;
  icon: string;
  price: number;
  discount: number;
  created: Date;
  extraOptions?: {
    title: string;
    values: Array<string>;
  };
  cover: {
    images: {
      ru: string;
      ua: string;
      eu: string;
      by: string;
    };
    descriptionFontSize: number;
    titleFontSize: number;
    catalogueTitleFontSize: number;
    description: string;
  };
  properties: {
    hidden: boolean;
    platforms: Array<string>;
    VBucks?: boolean;
  };

  getPriceIn(currency: Region): number;
  getRealPriceIn(currency: Region): number;
  getRealPrice(): number;
}

const ItemSchema = new Schema<IItem>(
  {
    title: {
      type: String,
      required: true
    },
    itemType: {
      type: String,
      required: true,
      enum: {
        values: Object.values(ITEM_TYPES),
        message: 'Недоступный тип товара: {VALUE}'
      },
      default: ITEM_TYPES.MANUAL
    },
    category: {
      type: SchemaTypes.ObjectId,
      required: true
    },
    created: {
      type: Date,
      required: true,
      default: Date.now
    },
    description: {
      type: String,
      required: true,
      maxlength: 3096
    },
    game: {
      type: String,
      required: true,
      enum: {
        values: Object.values(GAMES),
        message: 'Недоступная игра: {VALUE}'
      }
    },
    price: {
      type: Number,
      required: true,
      default: 300,
      min: [1, 'Цена должна быть больше 0']
    },
    discount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Скидка не может быть меньше 0'],
      max: [100, 'Скидка не может быть больше 100%']
    },
    icon: {
      type: String,
      required: true
    },
    properties: {
      hidden: {
        type: Boolean,
        required: true,
        default: false
      },
      platforms: {
        type: [String],
        required: true,
        default: Object.values(PLATFORMS).slice(0, -1),
        validate: {
          validator(platforms: Array<string>) {
            if (platforms.includes(PLATFORMS.NONE) && platforms.length > 1) {
              return false;
            }

            const platformsList = Object.values(PLATFORMS);
            let check = true;
            for (const item of platforms) {
              if (!platformsList.includes(item)) {
                check = false;
                break;
              }
            }

            return check;
          },
          message: 'Указана недоступная платформа или вместе с None было передано еще какое-либо значение'
        }
      },
      VBucks: Boolean
    },
    extraOptions: {
      title: {
        type: String,
        maxlength: 3096
      },
      values: {
        type: [
          {
            type: String,
            maxlength: 64
          }
        ],
        validate: (values: Array<string>) => values.length <= 64
      }
    },
    cover: {
      description: String,
      images: {
        ru: {
          type: String,
          required: true,
          default: DEFAULT_ITEM_COVER
        },
        ua: {
          type: String,
          required: true,
          default: DEFAULT_ITEM_COVER
        },
        eu: {
          type: String,
          required: true,
          default: DEFAULT_ITEM_COVER
        },
        by: {
          type: String,
          required: true,
          default: DEFAULT_ITEM_COVER
        }
      },
      descriptionFontSize: {
        type: Number,
        required: true,
        default: 34
      },
      titleFontSize: {
        type: Number,
        required: true,
        default: 57
      },
      catalogueTitleFontSize: {
        type: Number,
        required: true,
        default: 25
      }
    }
  },
  {
    methods: {
      getPriceIn(currency: Region): number {
        return Math.ceil(this.price / courses[currency]);
      },
      getRealPriceIn(currency: Region): number {
        return Math.ceil((this.getPriceIn(currency) * (100 - this.discount)) / 100);
      },
      getRealPrice(): number {
        return Math.ceil((this.price * (100 - this.discount)) / 100);
      }
    }
  }
);

const Item = model('goods', ItemSchema);
export default Item;
