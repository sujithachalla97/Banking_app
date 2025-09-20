import Account from '../models/Account.js';
import { fromPaise } from '../utils/money.js';

export const createAccount = async (req, res) => {
  try {
    const { type = 'SAV' } = req.body;
    const accountNumber = Math.random().toString(36).slice(2,14);
    const account = await Account.create({ userId: req.user.id, accountNumber, type, balance: 0 });
    res.status(201).json({ ok: true, account });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getMyAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user.id });
    res.json({ ok: true, accounts });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const getAccountById = async (req, res) => {
  try {
    const acc = await Account.findById(req.params.id);
    if (!acc) return res.status(404).json({ ok: false, message: 'Account not found' });
    if (acc.userId.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Forbidden' });
    res.json({ ok: true, account: acc });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const checkBalance = async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const acc = await Account.findById(accountId);
    if (!acc) return res.status(404).json({ ok: false, message: 'Account not found' });
    if (acc.userId.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ ok: false, message: 'Forbidden' });
    res.json({ ok: true, accountId: acc._id, balance: acc.balance, displayBalance: fromPaise(acc.balance), currency: acc.currency });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
