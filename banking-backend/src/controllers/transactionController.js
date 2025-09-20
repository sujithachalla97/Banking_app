import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { toPaise, fromPaise } from '../utils/money.js';

export const deposit = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { accountId, amount, description, refId } = req.body;
    const paise = toPaise(amount);
    session.startTransaction();

    const acc = await Account.findById(accountId).session(session);
    if (!acc) { await session.abortTransaction(); return res.status(404).json({ ok: false, message: 'Account not found' }); }
    if (acc.userId.toString() !== req.user.id && req.user.role !== 'admin') { await session.abortTransaction(); return res.status(403).json({ ok: false, message: 'Forbidden' }); }

    acc.balance += paise;
    await acc.save({ session });

    const [tx] = await Transaction.create([{
      accountId: acc._id,
      type: 'CREDIT',
      amount: paise,
      balanceAfter: acc.balance,
      description,
      refId
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ ok: true, transaction: tx, displayBalance: fromPaise(acc.balance) });
  } catch (err) {
    await session.abortTransaction().catch(()=>{});
    session.endSession();
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { accountId, amount, description } = req.body;
    const paise = toPaise(amount);
    session.startTransaction();

    const acc = await Account.findById(accountId).session(session);
    if (!acc) { await session.abortTransaction(); return res.status(404).json({ ok: false, message: 'Account not found' }); }
    if (acc.userId.toString() !== req.user.id && req.user.role !== 'admin') { await session.abortTransaction(); return res.status(403).json({ ok: false, message: 'Forbidden' }); }
    if (paise <= 0) { await session.abortTransaction(); return res.status(400).json({ ok: false, message: 'Invalid amount' }); }
    if (acc.balance < paise) { await session.abortTransaction(); return res.status(402).json({ ok: false, message: 'Insufficient funds' }); }

    acc.balance -= paise;
    await acc.save({ session });

    const [tx] = await Transaction.create([{
      accountId: acc._id,
      type: 'DEBIT',
      amount: paise,
      balanceAfter: acc.balance,
      description
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ ok: true, transaction: tx, displayBalance: fromPaise(acc.balance) });
  } catch (err) {
    await session.abortTransaction().catch(()=>{});
    session.endSession();
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const transfer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { fromAccountId, toIdentifier, amount, description, refId } = req.body;
    const paise = toPaise(amount);
    if (paise <= 0) return res.status(400).json({ ok: false, message: 'Invalid amount' });

    session.startTransaction();

    const from = await Account.findById(fromAccountId).session(session);
    if (!from) { await session.abortTransaction(); return res.status(404).json({ ok: false, message: 'From account not found' }); }
    if (from.userId.toString() !== req.user.id && req.user.role !== 'admin') { await session.abortTransaction(); return res.status(403).json({ ok: false, message: 'Forbidden' }); }
    if (from.balance < paise) { await session.abortTransaction(); return res.status(402).json({ ok: false, message: 'Insufficient funds' }); }

    // resolve recipient
    let to = await Account.findOne({ accountNumber: toIdentifier }).session(session);
    if (!to) {
      const user = await User.findOne({ email: toIdentifier }).session(session);
      if (user) to = await Account.findOne({ userId: user._id }).session(session);
    }
    if (!to) { await session.abortTransaction(); return res.status(404).json({ ok: false, message: 'Recipient not found' }); }
    if (to._id.equals(from._id)) { await session.abortTransaction(); return res.status(400).json({ ok: false, message: 'Cannot transfer to same account' }); }

    from.balance -= paise;
    to.balance += paise;
    await from.save({ session });
    await to.save({ session });

    const [txFrom, txTo] = await Transaction.create([
      { accountId: from._id, type: 'DEBIT', amount: paise, balanceAfter: from.balance, description, refId, meta: { transferTo: to._id } },
      { accountId: to._id, type: 'CREDIT', amount: paise, balanceAfter: to.balance, description, refId, meta: { transferFrom: from._id } }
    ], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      ok: true,
      transferRef: refId || null,
      from: { id: from._id, balance: from.balance, displayBalance: fromPaise(from.balance) },
      to: { id: to._id, balance: to.balance, displayBalance: fromPaise(to.balance) },
      transactions: [txFrom, txTo]
    });
  } catch (err) {
    await session.abortTransaction().catch(()=>{});
    session.endSession();
    res.status(500).json({ ok: false, message: err.message });
  }
};
