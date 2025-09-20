// src/controllers/transactionController.js
import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';

// helper to ensure integer paise
function toPaise(amountFloatOrNumber) {
  return Math.round(Number(amountFloatOrNumber) * 100);
}

// Deposit (admin only)
export async function deposit(req, res) {
  const session = await mongoose.startSession();
  try {
    const { accountId, amount, description, refId } = req.body;
    if (!accountId || amount == null) return res.status(400).json({ error: 'accountId and amount required' });

    const amt = toPaise(amount);
    if (amt <= 0) return res.status(400).json({ error: 'amount must be positive' });

    session.startTransaction();

    const account = await Account.findById(accountId).session(session);
    if (!account) throw new Error('Account not found');
    if (account.status !== 'active') throw new Error('Account not active');

    if (refId) {
      const existing = await Transaction.findOne({ accountId, refId }).session(session);
      if (existing) {
        await session.abortTransaction();
        return res.status(409).json({ error: 'Duplicate refId' });
      }
    }

    account.balance += amt;
    await account.save({ session });

    // single-doc create with session
    const txn = await Transaction.create({
      accountId: account._id,
      type: 'CREDIT',
      amount: amt,
      balanceAfter: account.balance,
      description: description || 'Deposit',
      refId: refId || null
    }, { session });

    await session.commitTransaction();
    res.status(201).json({ ok: true, transaction: txn });
  } catch (e) {
    await session.abortTransaction();
    res.status(400).json({ error: e.message });
  } finally {
    session.endSession();
  }
}

// Withdraw (customer: from their own account)
export async function withdraw(req, res) {
  const session = await mongoose.startSession();
  try {
    const { accountId, amount, description, refId } = req.body;
    if (!accountId || amount == null) return res.status(400).json({ error: 'accountId and amount required' });

    const amt = toPaise(amount);
    if (amt <= 0) return res.status(400).json({ error: 'amount must be positive' });

    session.startTransaction();

    const account = await Account.findById(accountId).session(session);
    if (!account) throw new Error('Account not found');

    if (req.user.role !== 'admin' && account.userId.toString() !== req.user.id) {
      throw new Error('Forbidden');
    }

    if (account.status !== 'active') throw new Error('Account not active');
    if (account.balance < amt) throw new Error('INSUFFICIENT_FUNDS');

    if (refId) {
      const existing = await Transaction.findOne({ accountId, refId }).session(session);
      if (existing) {
        await session.abortTransaction();
        return res.status(409).json({ error: 'Duplicate refId' });
      }
    }

    account.balance -= amt;
    await account.save({ session });

    // single-doc create with session
    const txn = await Transaction.create({
      accountId: account._id,
      type: 'DEBIT',
      amount: amt,
      balanceAfter: account.balance,
      description: description || 'Withdraw',
      refId: refId || null
    }, { session });

    await session.commitTransaction();
    res.status(201).json({ ok: true, transaction: txn });
  } catch (e) {
    await session.abortTransaction();
    res.status(400).json({ error: e.message });
  } finally {
    session.endSession();
  }
}

// Internal transfer (from one account to another) — atomic
export async function transfer(req, res) {
  const session = await mongoose.startSession();
  try {
    const { fromAccountId, toAccountNumber, amount, description, refId } = req.body;
    if (!fromAccountId || !toAccountNumber || amount == null) return res.status(400).json({ error: 'fromAccountId, toAccountNumber, amount required' });

    const amt = toPaise(amount);
    if (amt <= 0) return res.status(400).json({ error: 'amount must be positive' });

    session.startTransaction();

    const fromAcc = await Account.findById(fromAccountId).session(session);
    if (!fromAcc) throw new Error('Source account not found');

    if (req.user.role !== 'admin' && fromAcc.userId.toString() !== req.user.id) throw new Error('Forbidden');

    if (fromAcc.status !== 'active') throw new Error('Source account not active');
    if (fromAcc.balance < amt) throw new Error('INSUFFICIENT_FUNDS');

    const toAcc = await Account.findOne({ accountNumber: toAccountNumber }).session(session);
    if (!toAcc) throw new Error('Destination account not found');
    if (toAcc.status !== 'active') throw new Error('Destination account not active');

    if (refId) {
      const existing = await Transaction.findOne({ accountId: fromAcc._id, refId }).session(session);
      if (existing) {
        await session.abortTransaction();
        return res.status(409).json({ error: 'Duplicate refId' });
      }
    }

    fromAcc.balance -= amt;
    toAcc.balance += amt;

    await fromAcc.save({ session });
    await toAcc.save({ session });

    const transferRef = refId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    const txns = [
      {
        accountId: fromAcc._id,
        type: 'DEBIT',
        amount: amt,
        balanceAfter: fromAcc.balance,
        description: description || `Transfer to ${toAcc.accountNumber}`,
        refId: transferRef
      },
      {
        accountId: toAcc._id,
        type: 'CREDIT',
        amount: amt,
        balanceAfter: toAcc.balance,
        description: description || `Transfer from ${fromAcc.accountNumber}`,
        refId: transferRef
      }
    ];

    // use insertMany for multiple docs with session
    await Transaction.insertMany(txns, { session });

    await session.commitTransaction();
    res.status(201).json({ ok: true, transferRef, from: { id: fromAcc._id, balance: fromAcc.balance }, to: { id: toAcc._id, balance: toAcc.balance } });
  } catch (e) {
    await session.abortTransaction();
    res.status(400).json({ error: e.message });
  } finally {
    session.endSession();
  }
}
