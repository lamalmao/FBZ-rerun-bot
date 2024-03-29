import { Document, Schema, SchemaTypes, Types, model } from 'mongoose';
import { courses } from './goods.js';

export type UserRole = 'admin' | 'client' | 'manager';
export type UserStatus = 'normal' | 'blocked';
export type Region = 'ru' | 'ua' | 'by' | 'eu';

export const ONLINE_SHIFT = 15 * 60 * 1000;

export const REGIONS = {
  RU: 'ru',
  UA: 'ua',
  EU: 'eu',
  BY: 'by'
};

export const ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client',
  MANAGER: 'manager'
};

export const STATUSES = {
  NORMAL: 'normal',
  BLOCKED: 'blocked'
};

export interface IManagerStatisticsField {
  item: Types.ObjectId;
  title: string;
  sells: number;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  telegramId: number;
  username: string;
  balance: number;
  role: UserRole;
  joinDate?: Date;
  onlineUntil?: Date;
  lastAction?: Date;
  status: UserStatus;
  statistics?: IManagerStatisticsField;
  games?: Array<string>;
  region: Region;
  blocked: boolean;

  getBalanceIn(region: Region): number;
}

const ManagerStatisticsSchema = new Schema<IManagerStatisticsField>({
  item: {
    type: SchemaTypes.ObjectId,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  sells: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  }
});

const UserSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      default: 'unknown'
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.CLIENT as UserRole
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    joinDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    onlineUntil: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + ONLINE_SHIFT)
    },
    lastAction: {
      type: Date,
      required: true,
      default: Date.now
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(STATUSES)
      // default: STATUSES.NORMAL
    },
    statistics: {
      type: [ManagerStatisticsSchema],
      default: []
    },
    games: {
      type: [String]
      // enum: []
    },
    region: {
      type: String,
      required: true,
      enum: Object.values(REGIONS)
    },
    blocked: {
      type: Boolean,
      default: false
    }
  },
  {
    methods: {
      getBalanceIn(region: Region): number {
        return Math.ceil(this.balance / courses[region]);
      }
    }
  }
);

const User = model('users', UserSchema);

export default User;
