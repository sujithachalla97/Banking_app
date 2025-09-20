// src/controllers/txController.js
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import CustomerProfile from '../models/CustomerProfile.js';
import { toPaise, fromPaise } from '../utils/money.js';

/**
 * Deposit into an account (credit).
 */
export const deposit = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { accountId, amount, description = '', refId } = req.body;
    const paise = toPaise(amount);

    if (paise <= 0) return res.status(400).json({ ok: false, message: 'Invalid amount' });

    session.startTransaction();

    const acc = await Account.findById(accountId).session(session);
    if (!acc) {
      await session.abortTransaction();
      return res.status(404).json({ ok: false, message: 'Account not found' });
    }

    // Ownership check (allow admin)
    if (acc.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    // Idempotency: if refId exists, don't double-credit
    if (refId) {
      const existing = await Transaction.findOne({ refId, accountId }).session(session);
      if (existing) {
        await session.commitTransaction();
        return res.status(200).json({ ok: true, message: 'Deposit already processed', transaction: existing });
      }
    }

    acc.balance += paise;
    await acc.save({ session });

    // create transaction (single doc) - use save for clarity
    const tx = new Transaction({
      accountId: acc._id,
      type: 'CREDIT',
      amount: paise,
      balanceAfter: acc.balance,
      description,
      refId
    });
    await tx.save({ session });

    await session.commitTransaction();

    return res.json({
      ok: true,
      transaction: tx,
      displayBalance: fromPaise(acc.balance)
    });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * Withdraw from an account (debit).
 */
export const withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { accountId, amount, description = '' } = req.body;
    const paise = toPaise(amount);

    if (paise <= 0) return res.status(400).json({ ok: false, message: 'Invalid amount' });

    session.startTransaction();

    const acc = await Account.findById(accountId).session(session);
    if (!acc) {
      await session.abortTransaction();
      return res.status(404).json({ ok: false, message: 'Account not found' });
    }

    if (acc.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    if (acc.balance < paise) {
      await session.abortTransaction();
      return res.status(402).json({ ok: false, message: 'Insufficient funds' });
    }

    acc.balance -= paise;
    await acc.save({ session });

    const tx = new Transaction({
      accountId: acc._id,
      type: 'DEBIT',
      amount: paise,
      balanceAfter: acc.balance,
      description
    });
    await tx.save({ session });

    await session.commitTransaction();

    return res.json({ ok: true, transaction: tx, displayBalance: fromPaise(acc.balance) });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * Transfer between accounts (atomic).
 * Accepts: toIdentifier OR toAccountNumber (backwards compatible).
 * toIdentifier can be accountNumber | email | phone.
 */

export const transfer = async (req, res) => {
  try {
    const { fromAccountId, toIdentifier: rawToIdentifier, toAccountNumber, amount, description = '', refId } = req.body;
    const rawId = (typeof toAccountNumber === 'string' && toAccountNumber.trim()) ? toAccountNumber : rawToIdentifier;
    const toIdentifier = (typeof rawId === 'string') ? rawId.trim() : rawId;
    const paise = toPaise(amount);
    if (paise <= 0) return res.status(400).json({ ok: false, message: 'Invalid amount' });

    // Idempotency check
    if (refId) {
      const prev = await Transaction.findOne({ refId });
      if (prev) {
        const pair = await Transaction.find({ refId });
        return res.status(200).json({ ok: true, message: 'Transfer already processed', transactions: pair });
      }
    }

    // Resolve recipient (same logic you had)
    let to = null;
    if (toIdentifier) {
      to = await Account.findOne({ accountNumber: toIdentifier });
      if (!to && toIdentifier.includes('@')) {
        const user = await User.findOne({ email: toIdentifier.toLowerCase() });
        if (user) to = await Account.findOne({ userId: user._id });
      }
      if (!to) {
        const phoneNormalized = String(toIdentifier).replace(/[^\d]/g, '');
        if (phoneNormalized) {
          const profile = await CustomerProfile.findOne({ phone: phoneNormalized });
          if (profile) to = await Account.findOne({ userId: profile.userId });
        }
      }
    }
    if (!to) return res.status(404).json({ ok: false, message: 'Recipient not found' });

    if (to._id.equals(fromAccountId)) return res.status(400).json({ ok: false, message: 'Cannot transfer to same account' });

    // Ownership check and atomic debit using conditional update
    const fromAccount = await Account.findById(fromAccountId);
    if (!fromAccount) return res.status(404).json({ ok: false, message: 'From account not found' });
    if (fromAccount.userId.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ ok: false, message: 'Forbidden' });

    // Atomic debit: only decrement if balance >= paise
    const updatedFrom = await Account.findOneAndUpdate(
      { _id: fromAccount._id, balance: { $gte: paise } },
      { $inc: { balance: -paise } },
      { new: true }
    );

    if (!updatedFrom) {
      // condition failed => insufficient funds
      return res.status(402).json({ ok: false, message: 'Insufficient funds' });
    }

    // Credit recipient (atomic increment)
    const updatedTo = await Account.findByIdAndUpdate(
      to._id,
      { $inc: { balance: paise } },
      { new: true }
    );

    // Write transactions (two docs). Use ordered:true for multi-doc create
    const txDocs = [
      { accountId: fromAccount._id, type: 'DEBIT', amount: paise, balanceAfter: updatedFrom.balance, description, refId, meta: { transferTo: to._id } },
      { accountId: to._id, type: 'CREDIT', amount: paise, balanceAfter: updatedTo.balance, description, refId, meta: { transferFrom: fromAccount._id } }
    ];
    const [txFrom, txTo] = await Transaction.create(txDocs, { ordered: true });

    return res.json({
      ok: true,
      transferRef: refId || null,
      from: { id: updatedFrom._id, balance: updatedFrom.balance, displayBalance: fromPaise(updatedFrom.balance) },
      to: { id: updatedTo._id, balance: updatedTo.balance, displayBalance: fromPaise(updatedTo.balance) },
      transactions: [txFrom, txTo]
    });
  } catch (err) {
    console.error('transfer error:', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};