import { Schema, SchemaTypes, Types, model } from 'mongoose';
import { REGIONS, Region } from './users.js';
import crypto from 'crypto';

export type RefundStatus = 'rejected' | 'approved' | 'waiting';
export const REFUND_STATUSES = {
  REJECTED: 'rejected',
  APPROVED: 'approved',
  WAITING: 'waiting'
};

export type OrderStatus = 'untaken' | 'processing' | 'done' | 'refund' | 'canceled';
export const ORDER_STATUSES = {
  UNTAKEN: 'untaken',
  PROCESSING: 'processing',
  DONE: 'done',
  REFUND: 'refund',
  CANCELED: 'canceled'
};

export interface IOrder {
  orderId: number;
  client: number;
  manager: number;
  status: string | OrderStatus;
  creationDate: Date;
  closingDate?: Date;
  item: {
    id: Types.ObjectId;
    title: string;
  };
  price: {
    amount: number;
    region: Region | string;
  };
  paid: boolean;
  platform: string;
  data: object;
  refund?: {
    status: RefundStatus;
    data: string;
  };
}

const OrderSchema = new Schema<IOrder>({
  orderId: {
    type: Number,
    required: true,
    unique: true,
    default() {
      return crypto.randomInt(1_000_000, 10_000_000);
    }
  },
  client: {
    type: Number,
    required: true
  },
  manager: Number,
  status: {
    type: String,
    required: true,
    default: ORDER_STATUSES.PROCESSING,
    enum: {
      values: Object.values(ORDER_STATUSES),
      message: 'Неизвестный статус заказа: {VALUE}'
    }
  },
  creationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  closingDate: Date,
  price: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    region: {
      type: String,
      required: true,
      enum: {
        values: Object.values(REGIONS),
        message: 'Недоступный регион оплаты: {VALUE}'
      },
      default: REGIONS.RU
    }
  },
  item: {
    id: {
      type: SchemaTypes.ObjectId,
      required: true
    },
    title: {
      type: String,
      required: true
    }
  },
  paid: {
    type: Boolean,
    required: true,
    default: false
  },
  platform: String,
  refund: {
    status: {
      type: String,
      enum: {
        values: Object.values(ORDER_STATUSES),
        message: 'Неизвестный статус заказ: {VALUE}'
      }
    },
    data: String
  },
  data: SchemaTypes.Mixed
});

const Order = model('orders', OrderSchema);
export default Order;
