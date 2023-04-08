import { Schema, model } from 'mongoose';
import { Region } from './users.js';
import crypto from 'crypto';

export type PaymentStatus = 'waiting' | 'paid' | 'rejected';
export const PAYMENT_STATUSES = {
  WAITING: 'waiting',
  PAID: 'paid',
  REJECTED: 'rejected'
};

export type PaymentPlatform = 'anypay';

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
}

const PaymentSchema = new Schema<IPayment>({
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
    }
  }
});

const Payment = model('payments', PaymentSchema);
export default Payment;
