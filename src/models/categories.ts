import { Document, Schema, SchemaTypes, Types, model } from 'mongoose';

export const CATEGORY_BLANK = 'default_category';
export type CategoryType = 'main' | 'sub';

export const CATEGORY_TYPES = {
  MAIN: 'main',
  SUB: 'sub'
};

export interface ICategory extends Document {
  title: string;
  description?: string;
  covers?: {
    ru: string;
    eu: string;
    by: string;
    ua: string;
  };
  image?: string;
  type: CategoryType;
  parent?: Types.ObjectId | undefined;
  hidden: boolean;
}

const CategorySchema = new Schema<ICategory>({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false,
    maxlength: 3096
  },
  covers: {
    ru: {
      type: String,
      default: CATEGORY_BLANK
    },
    eu: {
      type: String,
      default: CATEGORY_BLANK
    },
    ua: {
      type: String,
      default: CATEGORY_BLANK
    },
    by: {
      type: String,
      default: CATEGORY_BLANK
    }
  },
  image: {
    type: String,
    required: false,
    default: CATEGORY_BLANK
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: Object.values(CATEGORY_TYPES),
      message: 'Недоступный тип категории: {VALUE}'
    }
  },
  hidden: {
    type: Boolean,
    required: true,
    default: false
  },
  parent: {
    type: SchemaTypes.ObjectId,
    required: false
  }
});

const Category = model('categories', CategorySchema);
export default Category;
