import { Schema, model } from 'mongoose';
import User, { Region } from './users.js';
import crypto from 'crypto';
import { Settings } from '../properties.js';
import { errorLogger } from '../logger.js';
import { courses } from './goods.js';

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
  close(): Promise<boolean>;
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
    },
    status: {
      type: String,
      required: true,
      default: 'waiting',
      enum: ['waiting', 'paid']
    },
    telegramMessage: Number
  },
  {
    methods: {
      genAnyPayLink(): string {
        const signString = `RUB:${this.price.amount}:${Settings.anypay.token}:${Settings.anypay.project}:${this.paymentId}`;
        const sign = crypto.createHash('md5').update(signString).digest('hex');

        // prettier-ignore
        return `https://anypay.io/merchant?merchant_id=${Settings.anypay.project}&pay_id=${this.paymentId}&amount=${this.price.amount.toFixed(2)}&currency=RUB&sign=${sign}`
      },
      async close(): Promise<boolean> {
        try {
          this.status = 'paid';
          this.isNew = false;
          await this.save();

          const result = await User.updateOne(
            {
              telegramId: this.user
            },
            {
              $inc: {
                balance: Math.ceil(this.price.amount * courses[this.price.region])
              }
            }
          );

          return result.matchedCount > 0;
        } catch (error: any) {
          errorLogger.error(error.message);
          return false;
        }
      }
    }
  }
);

const Payment = model('payments', PaymentSchema);
export default Payment;
