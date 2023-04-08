import { Schema, SchemaTypes, Types, model } from 'mongoose';

export const CATEGORY_BLANK = 'category_blank.jpg';
export type CategoryType = 'main' | 'sub';

export const CATEGORY_TYPES = {
  MAIN: 'main',
  SUB: 'sub'
};

export interface ICategory {
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
  parent: Types.ObjectId;
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
      type: String
    },
    eu: {
      type: String
    },
    ua: {
      type: String
    },
    by: {
      type: String
    },
    required: false
  },
  image: {
    type: String,
    required: false
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
    required: true
  }
});

const Category = model('categories', CategorySchema);
export default Category;
