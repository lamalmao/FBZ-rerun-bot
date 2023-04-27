import { Schema, model } from 'mongoose';
import { Region } from './users.js';
import crypto from 'crypto';
import { Settings } from '../properties.js';

export type PaymentStatus = 'waiting' | 'paid' | 'rejected';
export const PAYMENT_STATUSES = {
  WAITING: 'waiting',
  PAID: 'paid',
  REJECTED: 'rejected'
};

export type PaymentPlatform = 'anypay';
export const PAYMENT_PLATFORMS = {
  ANYPAY: 'anypay'
};

export interface IPayment {
  user: number;
  paymentId: number;
  status: string | PaymentStatus;
  telegramMessage: number;
  price: {
    region: string | Region;
    amount: number;
  };
  platform: PaymentPlatform | string;
  creationDate: Date;
  paymentDate?: Date;
  transactionId?: number;
  genAnyPayLink(): string;
}

const PaymentSchema = new Schema<IPayment>(
  {
    user: {
      type: Number,
      required: true
    },
    paymentId: {
      type: Number,
      required: true,
      unique: true,
      default() {
        return crypto.randomInt(1_000_000_000, 9_999_999_999);
      }
    },
    creationDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    paymentDate: Date,
    price: {
      region: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true
      }
    },
    platform: {
      type: String,
      required: true
    }
  },
  {
    methods: {
      genAnyPayLink(): string {
        const signString = `RUB:${this.price.amount}:${Settings.anypay.token}:${Settings.anypay.project}:${this.paymentId}`;
        const sign = crypto.createHash('md5').update(signString).digest('hex');

        // prettier-ignore
        return `https://anypay.io/merchant?merchant_id=${Settings.anypay.project}&pay_id=${this.paymentId}&amount=${this.price.amount.toFixed(2)}&currency=RUB&sign=${sign}`
      }
    }
  }
);

const Payment = model('payments', PaymentSchema);
export default Payment;
