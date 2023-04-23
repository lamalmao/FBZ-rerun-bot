import { Document, Schema, SchemaTypes, Types, model } from 'mongoose';
import mongooseFieldEncryption from 'mongoose-field-encryption';
import { DATA } from '../properties.js';

interface IKey extends Document {
  item: Types.ObjectId;
  content: string;
  added: Date;
  busy: boolean;
  sold: boolean;
  busyUntil?: Date;
  activated?: Date;
  order?: Types.ObjectId;
}

const KeySchema = new Schema<IKey>({
  item: {
    type: SchemaTypes.ObjectId,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  added: {
    type: Date,
    required: true,
    default: Date.now
  },
  busy: {
    type: Boolean,
    required: true,
    default: false
  },
  sold: {
    type: Boolean,
    required: true,
    default: false
  },
  activated: Date,
  order: SchemaTypes.ObjectId
});

KeySchema.plugin(mongooseFieldEncryption.fieldEncryption, {
  fields: ['value'],
  secret: DATA.secret
});

const Key = model('delivery', KeySchema);
export default Key;
