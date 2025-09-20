// src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import accountRoutes from './routes/account.js';
import customerProfileRoutes from './routes/customerProfile.js';
import transactionRoutes from './routes/transaction.js';

const app = express();
app.use(cors());
app.use(express.json());


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/profile', customerProfileRoutes);
app.use('/api/tx', transactionRoutes);


// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ msg: 'You are authorized', user: req.user });
});
const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();
