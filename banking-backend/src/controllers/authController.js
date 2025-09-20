import User from '../models/User.js';
import Account from '../models/Account.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP || '7d' });
}

export const register = async (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body;
    if (!name || !email || !password) return res.status(400).json({ ok: false, message: 'Missing fields' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ ok: false, message: 'Email already exists' });
    const role = inviteCode === 'admin_role' ? 'admin' : 'customer';
    const user = await User.create({ name, email, password, role });

    // create a primary account for the user
    const accountNumber = Math.random().toString(36).slice(2,14);
    const account = await Account.create({ userId: user._id, accountNumber, type: 'SAV', balance: 0 });

    res.status(201).json({
      ok: true,
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      accountId: account._id
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok: false, message: 'Missing fields' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    res.json({
      ok: true,
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};
