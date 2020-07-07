import mongoose from 'mongoose';

mongoose.connect(
  'mongodb+srv://root:root@cluster0.8hkml.gcp.mongodb.net/bank?retryWrites=true&w=majority',
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const accountSchema = mongoose.Schema({
  agencia: {
    type: Number,
    required: true,
  },
  conta: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  balance: {
    type: Number,
    required: true,
    validate(value) {
      if (value < 0) {
        throw new Error('O saldo não pode ser negativo');
      }
    },
  },
});

mongoose.model('account', accountSchema, 'account');
const accountModel = mongoose.model('account');

export { accountModel };
