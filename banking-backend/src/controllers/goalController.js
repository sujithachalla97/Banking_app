import Goal from '../models/Goal.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';
import { toPaise, fromPaise } from '../utils/money.js';

export const createGoal = async (req, res) => {
  try {
    const { title, targetAmount, deadline } = req.body;
    if (!title || !targetAmount) return res.status(400).json({ ok: false, message: 'Missing fields' });
    const goal = await Goal.create({ userId: req.user.id, title, targetAmount: toPaise(targetAmount), deadline });
    res.status(201).json({ ok: true, goal });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const depositToGoal = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { goalId, amount } = req.body;
    const paise = toPaise(amount);
    session.startTransaction();

    const goal = await Goal.findById(goalId).session(session);
    if (!goal) { await session.abortTransaction(); return res.status(404).json({ ok: false, message: 'Goal not found' }); }
    if (goal.userId.toString() !== req.user.id && req.user.role !== 'admin') { await session.abortTransaction(); return res.status(403).json({ ok: false, message: 'Forbidden' }); }

    const account = await Account.findOne({ userId: req.user.id }).session(session);
    if (!account) { await session.abortTransaction(); return res.status(404).json({ ok: false, message: 'Account not found' }); }
    if (account.balance < paise) { await session.abortTransaction(); return res.status(402).json({ ok: false, message: 'Insufficient funds' }); }

    account.balance -= paise;
    goal.currentAmount += paise;
    if (goal.currentAmount > goal.targetAmount) goal.overfunded = true;

    await account.save({ session });
    await goal.save({ session });

    const [tx] = await Transaction.create([{
      accountId: account._id, type: 'DEBIT', amount: paise, balanceAfter: account.balance, description: `Goal deposit: ${goal.title}`, meta: { goalId: goal._id }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ ok: true, newBalance: account.balance, displayNewBalance: fromPaise(account.balance), goal, transaction: tx });
  } catch (err) {
    await session.abortTransaction().catch(()=>{});
    session.endSession();
    res.status(500).json({ ok: false, message: err.message });
  }
};
