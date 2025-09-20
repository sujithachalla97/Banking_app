// src/controllers/accountController.js
import Account from '../models/Account.js';
import CustomerProfile from '../models/CustomerProfile.js';
import { v4 as uuidv4 } from 'uuid';

function generateAccountNumber() {
  return uuidv4().replace(/-/g, '').slice(0, 12);
}

export async function createAccount(req, res) {
  try {
    // admins should not create accounts
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot create accounts' });
    }

    // fetch customer profile
    const profile = await CustomerProfile.findOne({ userId: req.user.id });
    if (!profile) return res.status(400).json({ error: 'Complete KYC profile first' });
    if (profile.kycStatus !== 'verified') {
      return res.status(403).json({ error: 'KYC not verified yet' });
    }

    const { type } = req.body;
    const account = await Account.create({
      userId: req.user.id,
      accountNumber: generateAccountNumber(),
      type: type || 'SAV',
      balance: 0
    });
    res.status(201).json({ ok: true, account });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


// Get all accounts of logged-in user
export async function getMyAccounts(req, res) {
  try {
    const accounts = await Account.find({ userId: req.user.id });
    res.json({ ok: true, accounts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Get specific account details (only if owner or admin)
export async function getAccountById(req, res) {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (req.user.role !== 'admin' && account.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ ok: true, account });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
